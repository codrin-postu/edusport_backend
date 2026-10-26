# Phase 3-2: Athlete Data, Matching, Confirmation and Athlete Services (backend, no admin UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the backend everything the Înscrieri (3A) and Sportivi (3B) admin screens need: the one-name athlete, saved matching, the all-or-nothing confirmation with undo, school moves, registration edits with old -> new history, the private athlete list and record services (edit, status, add, delete, merge, duplicates, public profile), the public lookup of a merged profile's old address, the dashboard count, and the idempotent deploy scripts.

**Architecture:** Every rule is a pure TypeScript module in `src/club/` (birth dates, name and contact normalising, matching levels, confirmation and undo planners, merge planner, history texts, deploy planners), tested with Vitest. Services in `src/club/athletes/` run those planners against one storage interface, `ClubStore`, implemented twice: on Strapi (`strapi-store.ts`, with `strapi.db.transaction` and a row lock for the confirmation) and in memory for tests (`__tests__/fake-store.ts`, whose transaction restores a snapshot on failure, so all-or-nothing is unit tested). Controllers in `src/api/club/controllers/` stay thin: read the request, call one service, `respond(ctx, result)`. The deploy script follows `scripts/migrate-club-foundation.js`: one step per run, dry run by default, `--apply`, idempotent, planners compiled from `dist/src/club/`.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS, `strict: false`), Postgres in production, Vitest 3, Node 22.

**Checked while writing:** the code of Tasks 1 to 25 was applied to a scratch copy of the repo on 2026-10-26: every new Vitest test passed and `npx tsc --noEmit` had zero errors once `types/generated` carried the Task 1 attributes. Tasks 26 and 27 (scripts on Postgres) were not run.

**Spec:** `docs/superpowers/specs/2026-10-26-athletes-registrations-design.md`, sections 1, 2, 3.2, 3.4 to 3.6 (server side), 4.5 to 4.7, 6.6 and 6.7 (server side), 7 (dashboard count), 11 (deploy steps 7 to 12). Decisions log: `../edusport_frontend/docs/portal/DECISIONS.md` (a later dated entry wins). Brief shared by all phase 3 plans: `.superpowers/phase3-plan-brief.md`. The admin screens that call these routes are other plans; they read the "Interfaces for other plans" section at the end.

**Decided by the coordinator for this plan (2026-10-26):** spec 1.2 left the storage of a merged-away profile's address open. The surviving `sportsperson` gets a private json field `previousSlugs` (array of strings); a merge appends the deleted profile's slug and that profile's own `previousSlugs`. The public `GET /api/sportspeople?filters[previousSlugs][$contains]=<slug>` returns the surviving profile with its current `slug`, so the website answers a 308 to the current address (website side: plan 3-3 Task 6, Option A, unchanged). `previousSlugs` is never output by the public API and never shown in the admin. No separate redirect type and no website task in this plan.

**Choices this plan makes where the spec says "plan":**
- Athlete name field: `athlete.name` (string). `firstName` and `lastName` stay in the schema, no longer required and no longer written, because Strapi drops the column of a removed attribute on the next start (`@strapi/database` schema diff) and spec 1.1 needs them readable at deploy step 7. Removing the two attributes is a later cleanup after the deploy, outside this plan.
- Match result on the registration: `matchAthlete` (relation to the athlete) and `matchLevel` (`sigur` | `probabil`, empty when none); plus `childBirthDateParsed` (date) so "Vârstă" sorts on the server.
- What a confirmation wrote, for the undo: `confirmation` (json, private, hidden in the Content Manager) on the registration. Its presence is "confirmed through the window" (spec 3.3).
- Possible duplicates: hidden type `athlete-duplicate` (`first`, `second` relations to the athlete).
- `athlete.email` becomes a plain string (it was Strapi's `email` type, which would refuse an old registration's malformed address and make the whole confirmation fail).
- Undo of a field update reverts only fields that still hold the value the confirmation wrote, so a later edit is never overwritten; an A.C.S. status is reverted only while it is still "În așteptare".

## Needs decision

Each item below is a gap the spec leaves open. The plan implements option A in one named place so the answer is a small change; nothing else waits on it.

- **N1. Refusal texts the spec does not give.** These appear only when the admin screen's own guards were bypassed (a stale page, two tabs). Implemented in `src/club/athletes/errors.ts` as `ADMIN_ERRORS`.
  - A: `notFound` "Nu a fost găsit.", `stale` "Datele s-au schimbat. Reîncarcă pagina.", `nameRequired` "Completați numele.", `birthDate` "Alegeți data nașterii." (the website's text, spec 9), `invalid` "Cerere invalidă." (today's public submit text), `failed` "Acțiunea nu a reușit. Nimic nu a fost salvat." (undo, merge, delete).
  - B: other wording per case.
  - C: one generic text for all.
- **N2. History lines with no text in the spec.** Implemented in `src/club/history-text.ts` as `PENDING_COPY`.
  - (a) athlete added by "Adaugă sportiv": A "Fișă creată"; B no visible line.
  - (b) "Nu e același copil": A "Nu e același copil cu <nume>" on both records; B no visible line.
  - (c) registration archived or restored (full table): A label "Arhivată" in the field-edit line (`Arhivată: "Nu" → "Da"`); B no visible line.
  - (d) "who" of "Înscriere înregistrată": A blank; B the parent's name; C "Formular".
  - (e) rows written by the phase 1 and 2 migrations ("number-assigned"): A generic line `Nr. înscriere: "" → "2026-0001"`; B hidden.
- **N3. "Compară și actualizează" when the registration's value is empty and the athlete's is not.** A: not ticked by default (ticking it by hand clears the athlete's value); B: ticked like any other differing field (spec 4.2 read literally, which would clear data by default). Implemented in `src/club/confirm/compare.ts::comparisonRows`.
- **N4. "Anulează confirmarea" after a merge or a delete moved or unlinked the registration.** A: the merge and the delete clear the registration's `confirmation` record, so the undo is no longer offered for it; B: keep the undo by rewriting its references. Implemented in Tasks 23 and 24.
- **N5. A merged-away athlete's possible-duplicate flags with a third athlete.** A: re-pointed to the kept athlete (never a pair with itself, never twice); B: deleted. Implemented in `src/club/athletes/merge.ts::repointDuplicates`.
- **N6. Status of the kept record after a merge.** A: the kept record's status stays; B: the more active of the two (activ > nou > inactiv). Implemented in `src/club/athletes/merge-plan.ts::planMerge` (A writes nothing).
- **N7. Deploy step 7 when an athlete's first + last name differs from its public profile's current name** (the profile renamed in the old editor after phase 1). A: spec 1.1 as written: first + last, the profile untouched until the next name edit; the dry run lists every mismatch; B: the profile's current name becomes the athlete name; C: first + last, and the profile is renamed at deploy. Implemented in `src/club/deploy/name-migration.ts`.
- **N8. Old registrations with no form wish** (`membershipAnswer` empty, sent before the phase 2 form). A: treated like "Nu": no A.C.S. status written; B: read the old "Interes club" answer as the wish. Implemented in `src/club/confirm/plan.ts::planAcs`.
- **N9. Undo of a "Sportiv nou" whose new record got a public profile in between.** A: the profile counts as "something else", so the athlete is kept; B: the athlete and the profile are deleted. Implemented in `src/club/confirm/undo-plan.ts::isUnused`.


> **Needs decision N1 to N9: RESOLVED, option A for all (decided by Claude, low impact, 2026-10-26; logged in DECISIONS.md).** Executors keep the code as written.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, branch `feat/athletes` off `main`. Strapi 5.52.1, TypeScript.
- Run `npm ci` once on the branch first: the local `node_modules` of `main` lacked `pdfkit` and `unpdf` on 2026-10-26, which fails the phase 2 document tests and `submit-rate-limit.test.ts` before any change.
- After every task: `npx vitest run` passes, `npx tsc --noEmit` has zero errors; after a task that touches `src/admin/`: also `npx tsc --noEmit -p src/admin/tsconfig.json`.
- Single quotes in `src/`; functions < 30 lines; cyclomatic complexity < 10; no `any` (the Strapi instance is `Core.Strapi`, content type uids `UID.ContentType` or `as const` strings); data passed to a Strapi json attribute is a `type` alias, never an `interface`.
- Custom routes live in route files; hidden content types keep `createCoreRouter(uid, { only: [] })` and `pluginOptions.content-manager.visible: false`. Admin routes use `{ auth: false, policies: ['global::is-admin'], middlewares: [] }`; the actor comes from `adminActor` (`src/club/admin-actor.ts`). Every change writes a HistoryEntry (`src/club/history.ts`).
- A new schema attribute is saved only after a Strapi restart. After a schema change run `DATABASE_CLIENT=postgres npx strapi ts:generate-types` and commit `types/generated/` in the same task.
- `src/admin` is excluded from Vitest: testable logic lives in `src/club/*.ts`.
- Copy: Romanian UI copy exactly as in the spec; ș and ț with the comma below; no em dash; no middle dot; no emoji; terse. The spec's "->" in quoted copy is the arrow "→" the UI shows.
- Tests use synthetic data only; boot checks use a throwaway local Postgres container, never the user's local database and never production.
- Commits: Conventional Commits, no Co-Authored-By and no AI attribution in messages. Never push.

## Review Focus

- Two admins confirm the same registration at the same moment: exactly one confirmation is saved, the other gets "Înscrierea a fost deja confirmată de alt administrator." and nothing is written twice (Task 17 sequential test on the fake store; Task 27 two parallel requests on Postgres).
- A failure halfway through a confirmation (the group membership insert fails after the athlete was created): nothing stays, no athlete, no link, no A.C.S. status, no history line, and the answer is "Confirmarea nu a reușit. Nimic nu a fost salvat." (Task 17 `failOn` test; Task 27 with a `CHECK (false)` constraint on `group_memberships`).
- Undo after the admin changed the athlete in between (edited the phone, or the "Sportiv nou" got a second registration): the later edit survives, and an athlete with something else is kept, not deleted (Task 18 tests).
- Every deploy step run twice with `--apply`: the second run writes nothing, and past registrations never create the same child twice (Task 10 `covered` test; Task 27 runs each step dry, apply, apply again).
- A name change on the athlete renames the public profile in both its draft and its published row without publishing other draft edits and without touching the slug; after a merge of two profiles, the old address resolves to the kept profile through the public read, while `previousSlugs` never appears in any public JSON (Tasks 21 and 24 tests; Task 27 SQL and curl checks).

---

## File Structure

```
src/club/
  birth-date.ts            readable birth date formats, ISO and ZZ.LL.AAAA, age today, picker year range (Task 2)
  person-match.ts          collapseSpaces, normalizePhone, normalizeEmail, nameWords, withinOneEdit, sameName, shareNameWord (Task 3)
  matching.ts              matchLevel, rankCandidates, bestMatch, duplicateLevel, registrationFacts (Task 4)
  athlete-data.ts          AthleteValues, field labels, missing fields, readAthleteInput (Task 5)
  profile-slug.ts          slugify, uniqueSlug (Task 5); previousSlugQuery, previousSlugOwner (Task 24)
  history-text.ts          actions, history line texts, actor labels, PENDING_COPY (Task 6)
  acs.ts                   + ACS_WORDS, acsWord, isAcsState (Task 6); + ACS_RANK (Task 7)
  admin-result.ts          + status 500 (Task 11)
  registration-update.ts   the PUT of a registration: editable fields, old -> new history (Task 14)
  registration-list.ts     Înscrieri list row extras and school tabs (Task 15)
  confirm/
    season.ts              registrationSeason, seasonRunning, membershipFrom (Task 7)
    compare.ts             registrationValues, comparisonRows, defaultUpdateFields (Task 7)
    plan.ts                ConfirmRequest, ConfirmationRecord, planConfirmation, confirmRefusal (Task 7)
    history.ts             confirmationHistory (Task 7)
    undo-plan.ts           planUndo (Task 8)
  deploy/
    name-migration.ts      planNameMigration (Task 10)
    past-registrations.ts  planPastRegistrationAthletes (Task 10)
    duplicate-flags.ts     planDuplicateFlags (Task 10)
    deploy-status.ts       planDeployStatus (Task 10)
  athletes/
    errors.ts              CONFIRM_ERRORS, ADMIN_ERRORS (Task 5)
    merge-plan.ts          planMerge, mergeDiffering (Task 9)
    store.ts               ClubStore, row types, ServiceContext (Task 11)
    api-types.ts           every JSON shape the admin UI reads (Task 11)
    strapi-store.ts        ClubStore on Strapi (Task 11)
    http.ts                clubStore, serviceContext, queryText (Task 11)
    __tests__/fake-store.ts  in-memory ClubStore for tests (Task 11)
    matches.ts             planMatchUpdates, refreshAllMatches, refreshRegistrationMatch, safely (Task 12)
    registration-hooks.ts  afterRegistrationSubmitted, beforeRegistrationDeleted (Tasks 12, 14)
    history-read.ts        readHistory (Task 13)
    search.ts              matchesQuery, searchSubjects (Task 16)
    cards.ts               cardMaker, groupOptions (Task 16)
    confirm-read.ts        registrationMatchView, confirmContext, searchAthletes (Task 16)
    confirm-service.ts     confirmRegistration (Task 17)
    undo-service.ts        undoConfirmation (Task 18)
    school-move.ts         moveToSchool (Task 19)
    list.ts                readListQuery, listAthletes (Task 20)
    record.ts              readAthleteRecord, updateAthlete (Task 21)
    profile.ts             createAthleteProfile, setAthleteProfileVisibility, athleteIdForProfile (Task 21)
    add-status.ts          addAthlete, setAthleteStatus (Task 22)
    delete.ts              deleteAthlete (Task 23)
    merge.ts               mergePreview, mergeAthletes, dismissDuplicate (Task 24)
src/club/migrate/plan.ts   planAthletes writes `name` (Task 10)
src/club/migrate/names.ts  splitPersonName removed (Task 10)
src/api/athlete/content-types/athlete/schema.json                        name, email as string (Task 1)
src/api/athlete-duplicate/**                                             new hidden type (Task 1)
src/api/registration-submission/content-types/.../schema.json            match, parsed date, confirmation (Task 1)
src/api/sportsperson/content-types/sportsperson/schema.json              previousSlugs (Task 1)
src/api/sportsperson/controllers/sportsperson.ts                          find by a previous slug (Task 24)
src/api/registration-submission/controllers/registration-submission.ts   submit hook, PUT, delete, list (Tasks 12, 14, 15)
src/api/registration-submission/edit-deps.ts                             registrationEditDeps (Task 14)
src/api/registration-submission/list-search.ts                           + listSort, existingClause, schoolClause (Task 15)
src/api/club/controllers/registrations.ts, athletes.ts                   admin handlers (Tasks 13 to 24)
src/api/club/routes/04-registrations.ts, 05-athletes.ts                  admin routes (Tasks 13 to 24)
src/api/club/controllers/club.ts                                          summary + activeAthletes (Task 25)
src/admin/dashboard/DashboardPage.tsx                                     "Sportivi" tile reads activeAthletes (Task 25)
scripts/migrate-athletes-registrations.js                                deploy steps 7 to 12 (Task 26)
scripts/migrate-club-foundation.js                                       migrateAthletes writes `name` (Task 10)
```

## Tasks and parallel groups

| Group | Tasks | Runs after |
|---|---|---|
| A | 1 Schemas, 2 Birth dates, 3 Name and contact normalising | nothing; in parallel (separate files) |
| B | 4 Matching levels, 5 Athlete data rules | group A; in parallel |
| C | 6 History texts, 7 Confirmation planner, 9 Merge planner, 10 Deploy planners | group B; in parallel (7 and 6 both edit `acs.ts`: run 6 first or merge the two hunks) |
| D | 8 Undo planner, 11 Store and API types | 7 (8), 6 to 10 (11) |
| E | 12 to 25, in order | 11; they share `src/api/club/controllers/*.ts`, the two route files and the registration controller |
| F | 26 Deploy script | 12 (can run beside E from Task 13 on) |
| G | 27 Boot check on a throwaway Postgres | everything |

---
### Task 1: Schema changes

**Files:**
- Modify: `src/api/athlete/content-types/athlete/schema.json`
- Modify: `src/api/registration-submission/content-types/registration-submission/schema.json`
- Modify: `src/api/sportsperson/content-types/sportsperson/schema.json`
- Create: `src/api/athlete-duplicate/content-types/athlete-duplicate/schema.json`, `src/api/athlete-duplicate/routes/athlete-duplicate.ts`, `src/api/athlete-duplicate/controllers/athlete-duplicate.ts`, `src/api/athlete-duplicate/services/athlete-duplicate.ts`
- Modify: `src/club/__tests__/schemas.test.ts:6`
- Create: `src/club/__tests__/athletes-schemas.test.ts`
- Regenerate: `types/generated/contentTypes.d.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (database attributes every later task reads and writes):
  - athlete: `name` string (the one full name, "Nume și prenume"); `firstName`, `lastName` legacy strings, not required, read only by deploy step 7; `email` plain string.
  - registration-submission: `matchAthlete` manyToOne athlete, `matchLevel` enum `sigur|probabil`, `childBirthDateParsed` date, `confirmation` json (private, hidden).
  - athlete-duplicate (`api::athlete-duplicate.athlete-duplicate`, table `athlete_duplicates`): `first`, `second` manyToOne athlete.
  - sportsperson: `previousSlugs` json (private, hidden).

- [ ] **Step 1: Write the failing schema test**

`src/club/__tests__/athletes-schemas.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API = join(__dirname, '..', '..', 'api');
const schema = (name: string) => JSON.parse(readFileSync(join(API, name, 'content-types', name, 'schema.json'), 'utf8'));

describe('athlete, phase 3', () => {
  it('has one full-name field and keeps first/last readable until deploy step 7', () => {
    const a = schema('athlete').attributes;
    expect(a.name).toEqual({ type: 'string' });
    expect(a.firstName).toEqual({ type: 'string' });
    expect(a.lastName).toEqual({ type: 'string' });
  });

  it('stores the e-mail as plain text, so an old registration never fails a confirmation', () => {
    expect(schema('athlete').attributes.email).toEqual({ type: 'string' });
  });
});

describe('registration-submission, phase 3', () => {
  it('saves the match, the parsed birth date and what the confirmation wrote', () => {
    const a = schema('registration-submission').attributes;
    expect(a.matchAthlete).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::athlete.athlete' });
    expect(a.matchLevel).toEqual({ type: 'enumeration', enum: ['sigur', 'probabil'] });
    expect(a.childBirthDateParsed).toEqual({ type: 'date' });
    expect(a.confirmation).toEqual({ type: 'json', private: true, visible: false });
  });
});

describe('possible duplicates', () => {
  it('pair two athletes in a hidden type', () => {
    const s = schema('athlete-duplicate');
    expect(s.collectionName).toBe('athlete_duplicates');
    expect(s.pluginOptions).toEqual({ 'content-manager': { visible: false } });
    expect(s.attributes).toEqual({
      first: { type: 'relation', relation: 'manyToOne', target: 'api::athlete.athlete' },
      second: { type: 'relation', relation: 'manyToOne', target: 'api::athlete.athlete' },
    });
  });
});

describe('sportsperson, phase 3', () => {
  it('remembers the addresses merged into it, never in the public API or the admin', () => {
    expect(schema('sportsperson').attributes.previousSlugs).toEqual({ type: 'json', private: true, visible: false });
  });
});
```

In `src/club/__tests__/schemas.test.ts` line 6, add the new type so the "no draft and publish, no generated routes" checks cover it:

```ts
const NEW_TYPES = ['season', 'location', 'section', 'price-list', 'group', 'athlete', 'group-membership', 'acs-membership', 'history-entry', 'athlete-duplicate'];
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/__tests__/athletes-schemas.test.ts src/club/__tests__/schemas.test.ts`
Expected: FAIL (`a.name` undefined, `ENOENT ... athlete-duplicate`).

- [ ] **Step 3: Write the schemas**

`src/api/athlete/content-types/athlete/schema.json` (whole file):

```json
{
  "kind": "collectionType",
  "collectionName": "athletes",
  "info": { "singularName": "athlete", "pluralName": "athletes", "displayName": "Club / Sportiv" },
  "options": { "draftAndPublish": false },
  "pluginOptions": { "content-manager": { "visible": false } },
  "attributes": {
    "name": { "type": "string" },
    "firstName": { "type": "string" },
    "lastName": { "type": "string" },
    "birthDate": { "type": "date" },
    "contactName": { "type": "string" },
    "phone": { "type": "string" },
    "email": { "type": "string" },
    "status": { "type": "enumeration", "enum": ["nou", "activ", "inactiv"], "default": "activ", "required": true },
    "dataIncomplete": { "type": "boolean", "default": false },
    "notes": { "type": "text" },
    "publicProfile": { "type": "relation", "relation": "oneToOne", "target": "api::sportsperson.sportsperson" }
  }
}
```

`name` is not `required` in the schema on purpose: the ~60 existing rows hold no name until deploy step 7, and every writer (`readAthleteInput`, the confirmation, the deploy steps) refuses or never writes an empty name.

In `src/api/registration-submission/content-types/registration-submission/schema.json`, after the `"submissionKey"` attribute (keep the comma on the line before), add:

```json
    "matchAthlete": { "type": "relation", "relation": "manyToOne", "target": "api::athlete.athlete" },
    "matchLevel": { "type": "enumeration", "enum": ["sigur", "probabil"] },
    "childBirthDateParsed": { "type": "date" },
    "confirmation": { "type": "json", "private": true, "visible": false }
```

In `src/api/sportsperson/content-types/sportsperson/schema.json`, after the `"seasons"` attribute (add a comma after its closing brace), add:

```json
    "previousSlugs": {
      "type": "json",
      "private": true,
      "visible": false
    }
```

`src/api/athlete-duplicate/content-types/athlete-duplicate/schema.json`:

```json
{
  "kind": "collectionType",
  "collectionName": "athlete_duplicates",
  "info": { "singularName": "athlete-duplicate", "pluralName": "athlete-duplicates", "displayName": "Club / Posibilă dublură" },
  "options": { "draftAndPublish": false },
  "pluginOptions": { "content-manager": { "visible": false } },
  "attributes": {
    "first": { "type": "relation", "relation": "manyToOne", "target": "api::athlete.athlete" },
    "second": { "type": "relation", "relation": "manyToOne", "target": "api::athlete.athlete" }
  }
}
```

`src/api/athlete-duplicate/routes/athlete-duplicate.ts`:

```ts
import { factories } from '@strapi/strapi';

/** Private club data: no generated content-API routes; the admin reads flags through /api/club/athletes. */
export default factories.createCoreRouter('api::athlete-duplicate.athlete-duplicate', { only: [] });
```

`src/api/athlete-duplicate/controllers/athlete-duplicate.ts`:

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::athlete-duplicate.athlete-duplicate');
```

`src/api/athlete-duplicate/services/athlete-duplicate.ts`:

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::athlete-duplicate.athlete-duplicate');
```

- [ ] **Step 4: Regenerate the types and run the tests**

Run: `DATABASE_CLIENT=postgres npx strapi ts:generate-types && npx vitest run src/club/__tests__/athletes-schemas.test.ts src/club/__tests__/schemas.test.ts && npx tsc --noEmit`
Expected: PASS; `types/generated/contentTypes.d.ts` contains `ApiAthleteDuplicateAthleteDuplicate` and `previousSlugs`; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/api/athlete src/api/athlete-duplicate src/api/registration-submission/content-types src/api/sportsperson/content-types src/club/__tests__/athletes-schemas.test.ts src/club/__tests__/schemas.test.ts types/generated
git commit -m "feat(club): athlete full name, saved match, confirmation record, duplicate pairs, previous profile slugs"
```

---

### Task 2: Birth dates and age

**Files:**
- Create: `src/club/birth-date.ts`
- Test: `src/club/__tests__/birth-date.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (also imported by the admin UI plans):
  - `type DateParts = { year: number; month: number; day: number }`
  - `parseBirthDate(raw: unknown): DateParts | null` (the six readable forms of spec 1.3)
  - `readPickedDate(raw: unknown): DateParts | null` (ZZ.LL.AAAA only, what the zi / lună / an picker sends)
  - `isRealDate(p: DateParts): boolean`, `isoDate(p): string` (YYYY-MM-DD), `roDate(p): string` (ZZ.LL.AAAA), `partsFromIso(iso: unknown): DateParts | null`
  - `ageOn(birth: DateParts, today: DateParts): number`, `ageFromText(raw: unknown, today: DateParts): number | null`, `ageFromIso(iso: unknown, today: DateParts): number | null`
  - `birthDateSortKey(raw: unknown): string | null` (ISO or null)
  - `todayInBucharest(now?: Date): DateParts`
  - `birthYearRange(today: DateParts): { min: number; max: number }`, `birthYearOptions(today: DateParts, stored: number | null): number[]`

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/birth-date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ageFromIso,
  ageFromText,
  ageOn,
  birthDateSortKey,
  birthYearOptions,
  birthYearRange,
  isoDate,
  parseBirthDate,
  partsFromIso,
  readPickedDate,
  roDate,
  todayInBucharest,
} from '../birth-date';

const d = (year: number, month: number, day: number) => ({ year, month, day });
const TODAY = d(2026, 10, 26);

describe('parseBirthDate: the readable forms of spec 1.3', () => {
  it.each([
    ['14.03.2016', d(2016, 3, 14)],
    ['4.3.2016', d(2016, 3, 4)],
    ['14/03/2016', d(2016, 3, 14)],
    ['14-03-2016', d(2016, 3, 14)],
    ['2016-03-14', d(2016, 3, 14)],
    ['14 martie 2016', d(2016, 3, 14)],
    ['  14 Martie 2016 ', d(2016, 3, 14)],
  ])('reads %s', (raw, parts) => expect(parseBirthDate(raw)).toEqual(parts));

  it.each(['', '2016', '14/3/2016', '4-3-2016', '31.02.2016', '14 mart 2016', 'ieri', '14.03.16', '2016-3-14'])(
    'refuses %s',
    (raw) => expect(parseBirthDate(raw)).toBeNull(),
  );

  it('refuses anything that is not text', () => {
    expect(parseBirthDate(null)).toBeNull();
    expect(parseBirthDate(20160314)).toBeNull();
  });
});

describe('formats', () => {
  it('writes ISO and ZZ.LL.AAAA', () => {
    expect(isoDate(d(2016, 3, 4))).toBe('2016-03-04');
    expect(roDate(d(2016, 3, 4))).toBe('04.03.2016');
  });

  it('reads an ISO date back, and nothing else', () => {
    expect(partsFromIso('2016-03-04')).toEqual(d(2016, 3, 4));
    expect(partsFromIso('04.03.2016')).toBeNull();
    expect(partsFromIso(null)).toBeNull();
  });

  it('the picker sends only ZZ.LL.AAAA', () => {
    expect(readPickedDate('04.03.2016')).toEqual(d(2016, 3, 4));
    expect(readPickedDate('4.3.2016')).toBeNull();
    expect(readPickedDate('2016-03-04')).toBeNull();
    expect(readPickedDate('30.02.2016')).toBeNull();
  });

  it('sorts the registration list on the ISO date, null when unreadable', () => {
    expect(birthDateSortKey('14 martie 2016')).toBe('2016-03-14');
    expect(birthDateSortKey('ieri')).toBeNull();
  });
});

describe('age today (spec 3.1, 5)', () => {
  it('counts a birthday reached today and not one reached tomorrow', () => {
    expect(ageOn(d(2016, 10, 26), TODAY)).toBe(10);
    expect(ageOn(d(2016, 10, 27), TODAY)).toBe(9);
  });

  it('is blank (null) for a missing, unreadable or future date', () => {
    expect(ageFromText('14.03.2016', TODAY)).toBe(10);
    expect(ageFromText('', TODAY)).toBeNull();
    expect(ageFromText('ieri', TODAY)).toBeNull();
    expect(ageFromText('01.01.2030', TODAY)).toBeNull();
    expect(ageFromIso('2016-03-14', TODAY)).toBe(10);
    expect(ageFromIso(null, TODAY)).toBeNull();
  });

  it('takes the day in Romania, not in UTC', () => {
    expect(todayInBucharest(new Date('2026-10-25T22:30:00Z'))).toEqual(d(2026, 10, 26));
  });
});

describe('picker years (spec 9, P14)', () => {
  it('runs from 25 years ago to 2 years ago', () => {
    expect(birthYearRange(TODAY)).toEqual({ min: 2001, max: 2024 });
    const years = birthYearOptions(TODAY, null);
    expect([years[0], years[years.length - 1], years.length]).toEqual([2001, 2024, 24]);
  });

  it('keeps a stored year outside the range selectable', () => {
    expect(birthYearOptions(TODAY, 1999).slice(0, 2)).toEqual([1999, 2001]);
    expect(birthYearOptions(TODAY, 2010)).toHaveLength(24);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/birth-date.test.ts`
Expected: FAIL with "Cannot find module '../birth-date'".

- [ ] **Step 3: Write the implementation**

`src/club/birth-date.ts`:

```ts
/**
 * Children's birth dates (spec 1.3). The registration keeps free text; the athlete keeps a date.
 * Readable: ZZ.LL.AAAA, Z.L.AAAA, ZZ/LL/AAAA, ZZ-LL-AAAA, AAAA-LL-ZZ, "14 martie 2016". Anything else
 * is unreadable and blocks a confirmation (spec 4.7). Pure; the admin UI imports it too.
 */
export type DateParts = { year: number; month: number; day: number };

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

type Reader = (text: string) => DateParts | null;

const deaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function numeric(pattern: RegExp, order: 'dmy' | 'ymd'): Reader {
  return (text) => {
    const m = pattern.exec(text);
    if (!m) return null;
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return order === 'dmy' ? { day: a, month: b, year: c } : { year: a, month: b, day: c };
  };
}

const longMonth: Reader = (text) => {
  const m = /^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(text);
  if (!m) return null;
  const month = RO_MONTHS.indexOf(deaccent(m[2].toLowerCase())) + 1;
  return month > 0 ? { day: Number(m[1]), month, year: Number(m[3]) } : null;
};

const READERS: Reader[] = [
  numeric(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, 'dmy'),
  numeric(/^(\d{2})\/(\d{2})\/(\d{4})$/, 'dmy'),
  numeric(/^(\d{2})-(\d{2})-(\d{4})$/, 'dmy'),
  numeric(/^(\d{4})-(\d{2})-(\d{2})$/, 'ymd'),
  longMonth,
];

export function isRealDate(p: DateParts): boolean {
  if (p.year < 1900 || p.month < 1 || p.month > 12 || p.day < 1) return false;
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  return date.getUTCMonth() === p.month - 1 && date.getUTCDate() === p.day;
}

export function parseBirthDate(raw: unknown): DateParts | null {
  const text = typeof raw === 'string' ? raw.trim() : '';
  for (const read of READERS) {
    const parts = read(text);
    if (parts) return isRealDate(parts) ? parts : null;
  }
  return null;
}

/** What the zi / lună / an picker sends (admin edits): ZZ.LL.AAAA only. */
export function readPickedDate(raw: unknown): DateParts | null {
  const m = typeof raw === 'string' ? /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw.trim()) : null;
  if (!m) return null;
  const parts = { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) };
  return isRealDate(parts) ? parts : null;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (p: DateParts): string => `${p.year}-${pad(p.month)}-${pad(p.day)}`;
export const roDate = (p: DateParts): string => `${pad(p.day)}.${pad(p.month)}.${p.year}`;

export function partsFromIso(iso: unknown): DateParts | null {
  const m = typeof iso === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  const parts = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return isRealDate(parts) ? parts : null;
}

export function birthDateSortKey(raw: unknown): string | null {
  const parts = parseBirthDate(raw);
  return parts ? isoDate(parts) : null;
}

export function ageOn(birth: DateParts, today: DateParts): number {
  const before = today.month < birth.month || (today.month === birth.month && today.day < birth.day);
  return today.year - birth.year - (before ? 1 : 0);
}

const ageOrNull = (birth: DateParts | null, today: DateParts): number | null => {
  const age = birth ? ageOn(birth, today) : -1;
  return age >= 0 ? age : null;
};

/** "Vârstă": blank (null) when the date is missing, unreadable or in the future. */
export const ageFromText = (raw: unknown, today: DateParts): number | null => ageOrNull(parseBirthDate(raw), today);
export const ageFromIso = (iso: unknown, today: DateParts): number | null => ageOrNull(partsFromIso(iso), today);

export function todayInBucharest(now: Date = new Date()): DateParts {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

/** The website's year range (spec 9): from 25 years ago to 2 years ago. */
export function birthYearRange(today: DateParts): { min: number; max: number } {
  return { min: today.year - 25, max: today.year - 2 };
}

/** Ascending; a stored year outside the range stays selectable (P14). */
export function birthYearOptions(today: DateParts, stored: number | null): number[] {
  const { min, max } = birthYearRange(today);
  const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const extra = stored !== null && (stored < min || stored > max) ? [stored] : [];
  return [...extra, ...years].sort((a, b) => a - b);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/club/__tests__/birth-date.test.ts && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/birth-date.ts src/club/__tests__/birth-date.test.ts
git commit -m "feat(club): readable birth date formats, age today and picker years"
```

---

### Task 3: Name and contact normalising

**Files:**
- Create: `src/club/person-match.ts`
- Test: `src/club/__tests__/person-match.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `collapseSpaces(raw: unknown): string`, `normalizePhone(raw: unknown): string`, `normalizeEmail(raw: unknown): string`, `nameWords(raw: unknown): string[]`, `withinOneEdit(a: string, b: string): boolean`, `sameName(a: unknown, b: unknown): boolean`, `shareNameWord(a: unknown, b: unknown): boolean`.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/person-match.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { collapseSpaces, nameWords, normalizeEmail, normalizePhone, sameName, shareNameWord, withinOneEdit } from '../person-match';

describe('contact normalising (spec 2.1, gaps #14)', () => {
  it('keeps the phone digits and turns +40 / 0040 into 0', () => {
    expect(normalizePhone('+40 722 111 222')).toBe('0722111222');
    expect(normalizePhone('0040722111222')).toBe('0722111222');
    expect(normalizePhone('0722-111-222')).toBe('0722111222');
    expect(normalizePhone(null)).toBe('');
  });

  it('trims and lowercases the e-mail', () => {
    expect(normalizeEmail('  Ana.Pop@Example.RO ')).toBe('ana.pop@example.ro');
  });

  it('collapses spaces', () => expect(collapseSpaces('  Maria   Pop ')).toBe('Maria Pop'));
});

describe('name rule (spec 2.1)', () => {
  it('splits words without diacritics, cedilla letters included', () => {
    expect(nameWords('Ştefan  Ionescu-Pop')).toEqual(['stefan', 'ionescu', 'pop']);
    expect(nameWords('Ștefan Țăran')).toEqual(['stefan', 'taran']);
  });

  it('allows one wrong letter per word', () => {
    expect(withinOneEdit('dumitrescu', 'dumitresu')).toBe(true);
    expect(withinOneEdit('pop', 'pip')).toBe(true);
    expect(withinOneEdit('pop', 'popa')).toBe(true);
    expect(withinOneEdit('pop', 'pipa')).toBe(false);
  });

  it('ignores word order, diacritics and one typo per word', () => {
    expect(sameName('Maria Dumitrescu', 'Dumitresu Maria')).toBe(true);
    expect(sameName('Ștefania Ionescu', 'stefania ionescu')).toBe(true);
  });

  it('needs the same number of words, each paired once', () => {
    expect(sameName('Maria Dumitrescu', 'Maria Dumitrescu Pop')).toBe(false);
    expect(sameName('Ana Ana', 'Ana Ion')).toBe(false);
    expect(sameName('', '')).toBe(false);
  });

  it('finds one name word in common for Probabil', () => {
    expect(shareNameWord('Maria Pop', 'Pop Ioana')).toBe(true);
    expect(shareNameWord('Maria Pop', 'Ioana Popa')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/person-match.test.ts`
Expected: FAIL with "Cannot find module '../person-match'".

- [ ] **Step 3: Write the implementation**

`src/club/person-match.ts`:

```ts
/** Normalising for matching and search (spec 2.1): phone digits, e-mail, name words. Pure. */

export function collapseSpaces(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
}

/** Digits only; a leading +40 or 0040 becomes 0. */
export function normalizePhone(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  const digits = text.replace(/\D/g, '');
  if (text.startsWith('+40')) return `0${digits.slice(2)}`;
  return digits.startsWith('0040') ? `0${digits.slice(4)}` : digits;
}

export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/** Lower case, no diacritics (cedilla forms too), split on spaces and hyphens. */
export function nameWords(raw: unknown): string[] {
  return collapseSpaces(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
}

/** At most one letter added, removed or replaced. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && short[i] === long[i]) i += 1;
  const rest = short.length === long.length ? short.slice(i + 1) : short.slice(i);
  return rest === long.slice(i + 1);
}

function pairAll(left: string[], right: string[]): boolean {
  if (left.length === 0) return true;
  const [first, ...others] = left;
  return right.some((word, i) => withinOneEdit(first, word) && pairAll(others, [...right.slice(0, i), ...right.slice(i + 1)]));
}

/** Same name: same number of words, any order, one wrong letter per word. */
export function sameName(a: unknown, b: unknown): boolean {
  const left = nameWords(a);
  const right = nameWords(b);
  return left.length > 0 && left.length === right.length && pairAll(left, right);
}

export function shareNameWord(a: unknown, b: unknown): boolean {
  const right = new Set(nameWords(b));
  return nameWords(a).some((word) => right.has(word));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/club/__tests__/person-match.test.ts && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/person-match.ts src/club/__tests__/person-match.test.ts
git commit -m "feat(club): name and contact normalising for matching"
```

---

### Task 4: Matching levels

**Files:**
- Create: `src/club/matching.ts`
- Test: `src/club/__tests__/matching.test.ts`

**Interfaces:**
- Consumes: `isoDate`, `parseBirthDate` (Task 2); `normalizePhone`, `normalizeEmail`, `sameName`, `shareNameWord` (Task 3).
- Produces:
  - `type MatchLevel = 'sigur' | 'probabil' | 'alt-copil'`, `type StoredMatchLevel = 'sigur' | 'probabil'`
  - `type PersonFacts = { name: string; birthDate: string | null; phone: string | null; email: string | null }` (birth date ISO)
  - `type AthleteFacts = PersonFacts & { id: string; updatedAt: string }`, `type Candidate = { athleteId: string; level: StoredMatchLevel }`
  - `registrationFacts(r: { childName?: unknown; childBirthDate?: unknown; phone?: unknown; email?: unknown }): PersonFacts`
  - `matchLevel(child: PersonFacts, athlete: PersonFacts): MatchLevel | null`
  - `rankCandidates(child: PersonFacts, athletes: AthleteFacts[]): Candidate[]`, `bestMatch(child, athletes): Candidate | null`
  - `duplicateLevel(a: PersonFacts, b: PersonFacts): StoredMatchLevel | null`

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/matching.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bestMatch, duplicateLevel, matchLevel, rankCandidates, registrationFacts, type AthleteFacts, type PersonFacts } from '../matching';

const child: PersonFacts = { name: 'Maria Dumitrescu', birthDate: '2016-03-14', phone: '0722 111 222', email: 'ana@example.com' };
const athlete = (over: Partial<AthleteFacts> = {}): AthleteFacts => ({
  id: 'a1', name: 'Maria Dumitrescu', birthDate: '2016-03-14', phone: null, email: null, updatedAt: '2026-10-01T10:00:00.000Z', ...over,
});

describe('levels (spec 2.1)', () => {
  it('Sigur: same name and same birth date, any order, one typo per word', () => {
    expect(matchLevel(child, athlete({ name: 'Dumitresu Maria' }))).toBe('sigur');
  });

  it('Probabil: same birth date, same phone or e-mail, one name word in common', () => {
    expect(matchLevel(child, athlete({ name: 'Maria Ionescu', phone: '+40722111222' }))).toBe('probabil');
    expect(matchLevel(child, athlete({ name: 'Maria Ionescu', email: ' ANA@example.com' }))).toBe('probabil');
  });

  it('not Probabil without a common name word (and not Alt copil: the birth date is the same)', () => {
    expect(matchLevel(child, athlete({ name: 'Ioana Ionescu', phone: '0722111222' }))).toBeNull();
  });

  it('Probabil: an athlete without a birth date and the same name (Open #2)', () => {
    expect(matchLevel(child, athlete({ name: 'dumitrescu maria', birthDate: null }))).toBe('probabil');
  });

  it('Alt copil: same phone or e-mail, other birth date', () => {
    expect(matchLevel(child, athlete({ name: 'Andrei Dumitrescu', birthDate: '2013-01-02', phone: '0722111222' }))).toBe('alt-copil');
  });

  it('nothing else matches', () => {
    expect(matchLevel(child, athlete({ name: 'Andrei Pop', birthDate: '2013-01-02' }))).toBeNull();
  });

  it('an unreadable registration date is never Sigur', () => {
    expect(matchLevel({ ...child, birthDate: null }, athlete())).toBeNull();
  });
});

describe('several candidates (gaps #15)', () => {
  const sigur = athlete({ id: 'old', updatedAt: '2026-01-01T00:00:00.000Z' });
  const probabilOld = athlete({ id: 'p1', name: 'Maria Ionescu', phone: '0722111222', updatedAt: '2026-02-01T00:00:00.000Z' });
  const probabilNew = athlete({ id: 'p2', name: 'Maria Popescu', email: 'ana@example.com', updatedAt: '2026-09-01T00:00:00.000Z' });
  const sibling = athlete({ id: 's', name: 'Andrei Dumitrescu', birthDate: '2013-01-02', phone: '0722111222' });

  it('highest level first, then the most recently updated; Alt copil never listed', () => {
    expect(rankCandidates(child, [probabilOld, sibling, sigur, probabilNew])).toEqual([
      { athleteId: 'old', level: 'sigur' },
      { athleteId: 'p2', level: 'probabil' },
      { athleteId: 'p1', level: 'probabil' },
    ]);
    expect(bestMatch(child, [sibling])).toBeNull();
  });
});

describe('registrationFacts', () => {
  it('reads the free-text birth date as ISO, null when unreadable', () => {
    expect(registrationFacts({ childName: 'Maria', childBirthDate: '14 martie 2016', phone: '1', email: 'e' }).birthDate).toBe('2016-03-14');
    expect(registrationFacts({ childName: 'Maria', childBirthDate: 'ieri' }).birthDate).toBeNull();
  });
});

describe('possible duplicates between athletes (spec 2.3)', () => {
  it('flags Sigur and Probabil pairs', () => {
    expect(duplicateLevel(athlete(), athlete({ id: 'b' }))).toBe('sigur');
  });

  it('flags a pair where either side has no birth date and the names agree', () => {
    expect(duplicateLevel(athlete({ birthDate: null }), athlete({ id: 'b' }))).toBe('probabil');
    expect(duplicateLevel(athlete(), athlete({ id: 'b', birthDate: null }))).toBe('probabil');
  });

  it('leaves siblings alone', () => {
    expect(duplicateLevel(athlete({ phone: '1' }), athlete({ id: 'b', name: 'Andrei Dumitrescu', birthDate: '2013-01-02', phone: '1' }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/matching.test.ts`
Expected: FAIL with "Cannot find module '../matching'".

- [ ] **Step 3: Write the implementation**

`src/club/matching.ts`:

```ts
import { isoDate, parseBirthDate } from './birth-date';
import { normalizeEmail, normalizePhone, sameName, shareNameWord } from './person-match';

/**
 * Is this child already in the club (spec 2.1)? Levels are never shown as words; Sigur and Probabil show
 * "Sportiv existent", Alt copil shows nothing. Inactive athletes are compared too. Never auto-merges.
 */
export type MatchLevel = 'sigur' | 'probabil' | 'alt-copil';
export type StoredMatchLevel = 'sigur' | 'probabil';
/** Name as written, birth date as ISO (null when missing or unreadable), contact as typed. */
export type PersonFacts = { name: string; birthDate: string | null; phone: string | null; email: string | null };
export type AthleteFacts = PersonFacts & { id: string; updatedAt: string };
export type Candidate = { athleteId: string; level: StoredMatchLevel };

const textOrNull = (v: unknown) => (typeof v === 'string' ? v : null);

export function registrationFacts(r: { childName?: unknown; childBirthDate?: unknown; phone?: unknown; email?: unknown }): PersonFacts {
  const birth = parseBirthDate(r.childBirthDate);
  return { name: textOrNull(r.childName) ?? '', birthDate: birth ? isoDate(birth) : null, phone: textOrNull(r.phone), email: textOrNull(r.email) };
}

function sharesContact(a: PersonFacts, b: PersonFacts): boolean {
  const phone = normalizePhone(a.phone);
  const email = normalizeEmail(a.email);
  return (phone !== '' && phone === normalizePhone(b.phone)) || (email !== '' && email === normalizeEmail(b.email));
}

/** Same birth date: Sigur with the same name, Probabil with a shared contact and a common name word. */
function sameDateLevel(child: PersonFacts, athlete: PersonFacts): MatchLevel | null {
  if (sameName(child.name, athlete.name)) return 'sigur';
  return sharesContact(child, athlete) && shareNameWord(child.name, athlete.name) ? 'probabil' : null;
}

export function matchLevel(child: PersonFacts, athlete: PersonFacts): MatchLevel | null {
  if (child.birthDate !== null && child.birthDate === athlete.birthDate) return sameDateLevel(child, athlete);
  if (athlete.birthDate === null && sameName(child.name, athlete.name)) return 'probabil';
  return sharesContact(child, athlete) ? 'alt-copil' : null;
}

const RANK: Record<StoredMatchLevel, number> = { sigur: 2, probabil: 1 };
const isStored = (level: MatchLevel | null): level is StoredMatchLevel => level === 'sigur' || level === 'probabil';

/** Sigur and Probabil only: highest level first, then the most recently updated athlete. */
export function rankCandidates(child: PersonFacts, athletes: AthleteFacts[]): Candidate[] {
  const found: (Candidate & { updatedAt: string })[] = [];
  for (const a of athletes) {
    const level = matchLevel(child, a);
    if (isStored(level)) found.push({ athleteId: a.id, level, updatedAt: a.updatedAt });
  }
  found.sort((x, y) => RANK[y.level] - RANK[x.level] || y.updatedAt.localeCompare(x.updatedAt));
  return found.map(({ athleteId, level }) => ({ athleteId, level }));
}

export function bestMatch(child: PersonFacts, athletes: AthleteFacts[]): Candidate | null {
  return rankCandidates(child, athletes)[0] ?? null;
}

/** Possible duplicates at deploy (spec 2.3, P8): Sigur or Probabil, or one side without a birth date and the names agree. */
export function duplicateLevel(a: PersonFacts, b: PersonFacts): StoredMatchLevel | null {
  const level = matchLevel(a, b);
  if (isStored(level)) return level;
  return a.birthDate === null && sameName(a.name, b.name) ? 'probabil' : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/club/__tests__/matching.test.ts && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/matching.ts src/club/__tests__/matching.test.ts
git commit -m "feat(club): matching levels Sigur, Probabil, Alt copil"
```

---

### Task 5: Athlete data rules, profile slugs and refusal texts

**Files:**
- Create: `src/club/athletes/errors.ts`, `src/club/athlete-data.ts`, `src/club/profile-slug.ts`
- Test: `src/club/__tests__/athlete-data.test.ts`, `src/club/__tests__/profile-slug.test.ts`

**Interfaces:**
- Consumes: `changedFields`, `FieldChange` (`src/club/admin-result.ts`); `isoDate`, `partsFromIso`, `readPickedDate`, `roDate` (Task 2); `collapseSpaces` (Task 3).
- Produces:
  - `CONFIRM_ERRORS = { failed, taken, birthDate }`, `ADMIN_ERRORS = { notFound, stale, nameRequired, birthDate, invalid, failed }`
  - `type AthleteStatus = 'nou' | 'activ' | 'inactiv'`, `ATHLETE_STATUSES`
  - `ATHLETE_FIELDS = ['name', 'birthDate', 'contactName', 'phone', 'email'] as const`, `type AthleteField`, `type AthleteValues = { [K in AthleteField]: string | null }` (birthDate ISO)
  - `ATHLETE_FIELD_LABELS`, `MISSING_FIELD_WORDS`, `isAthleteField(v)`, `pickAthleteValues(source)`, `missingFields(v)`, `isDataIncomplete(v)`, `missingText(fields)`, `athleteChanges(before, after)`, `athleteValueText(field, value)`, `birthDateForPicker(iso)`
  - `type AthleteInput = { ok: true; values: AthleteValues } | { ok: false; error: string }`, `readAthleteInput(body: unknown, mode: 'edit' | 'add'): AthleteInput`
  - `slugify(name: string): string`, `uniqueSlug(base: string, taken: ReadonlySet<string>): string`

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/athlete-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { athleteChanges, athleteValueText, birthDateForPicker, isDataIncomplete, missingFields, missingText, readAthleteInput, type AthleteValues } from '../athlete-data';
import { ADMIN_ERRORS } from '../athletes/errors';

const full: AthleteValues = { name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722111222', email: 'ana@example.com' };

describe('"Date incomplete" (spec 1.1, 3b Q20)', () => {
  it('is complete only with name, birth date, contact person, phone and e-mail', () => {
    expect(isDataIncomplete(full)).toBe(false);
    expect(missingFields({ ...full, email: null, birthDate: null })).toEqual(['birthDate', 'email']);
    expect(isDataIncomplete({ ...full, phone: null })).toBe(true);
  });

  it('words the missing fields like the hint', () => {
    expect(missingText(['birthDate', 'contactName', 'email'])).toBe('data nașterii, persoana de contact, e-mail');
  });
});

describe('readAthleteInput (Editează and Adaugă sportiv)', () => {
  it('reads the picker date into ISO and collapses spaces', () => {
    expect(readAthleteInput({ name: '  Maria   Pop ', birthDate: '14.03.2016', contactName: '', phone: ' 0722 ', email: null }, 'edit')).toEqual({
      ok: true,
      values: { name: 'Maria Pop', birthDate: '2016-03-14', contactName: null, phone: '0722', email: null },
    });
  });

  it('needs a name', () => {
    expect(readAthleteInput({ name: ' ' }, 'edit')).toEqual({ ok: false, error: ADMIN_ERRORS.nameRequired });
  });

  it('allows clearing the birth date when editing, not when adding (gaps #41)', () => {
    expect(readAthleteInput({ name: 'Maria', birthDate: '' }, 'edit')).toMatchObject({ ok: true, values: { birthDate: null } });
    expect(readAthleteInput({ name: 'Maria', birthDate: '' }, 'add')).toEqual({ ok: false, error: ADMIN_ERRORS.birthDate });
  });

  it('refuses a date that is not ZZ.LL.AAAA or not real', () => {
    expect(readAthleteInput({ name: 'Maria', birthDate: '2016-03-14' }, 'edit')).toEqual({ ok: false, error: ADMIN_ERRORS.birthDate });
    expect(readAthleteInput({ name: 'Maria', birthDate: '31.02.2016' }, 'add')).toEqual({ ok: false, error: ADMIN_ERRORS.birthDate });
  });

  it('reads a missing body as empty', () => {
    expect(readAthleteInput(null, 'edit')).toEqual({ ok: false, error: ADMIN_ERRORS.nameRequired });
  });
});

describe('changes and display', () => {
  it('lists old -> new per changed field', () => {
    expect(athleteChanges(full, { ...full, phone: '0733', email: null })).toEqual({
      phone: { from: '0722111222', to: '0733' },
      email: { from: 'ana@example.com', to: null },
    });
  });

  it('shows the birth date as ZZ.LL.AAAA and empties as blank', () => {
    expect(athleteValueText('birthDate', '2016-03-14')).toBe('14.03.2016');
    expect(athleteValueText('phone', null)).toBe('');
    expect(birthDateForPicker('2016-03-04')).toBe('04.03.2016');
    expect(birthDateForPicker(null)).toBeNull();
  });
});
```

`src/club/__tests__/profile-slug.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from '../profile-slug';

describe('profile address (spec 6.3)', () => {
  it('makes a web address from the name', () => {
    expect(slugify('Ștefan Ionescu-Pop')).toBe('stefan-ionescu-pop');
    expect(slugify('  Ana  Maria ')).toBe('ana-maria');
  });

  it('never returns an empty address', () => expect(slugify(' ! ')).toBe('sportiv'));

  it('skips addresses already used, old merged addresses included', () => {
    expect(uniqueSlug('ana', new Set(['ana', 'ana-2']))).toBe('ana-3');
    expect(uniqueSlug('ion', new Set(['ana']))).toBe('ion');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/__tests__/athlete-data.test.ts src/club/__tests__/profile-slug.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the implementation**

`src/club/athletes/errors.ts`:

```ts
/**
 * Refusal texts of the 3A+3B admin routes. CONFIRM_ERRORS are the spec's (4.7). ADMIN_ERRORS show only when
 * the admin screen's own guards were bypassed (a stale page); their wording waits on plan item N1 (option A).
 */
export const CONFIRM_ERRORS = {
  failed: 'Confirmarea nu a reușit. Nimic nu a fost salvat.',
  taken: 'Înscrierea a fost deja confirmată de alt administrator.',
  birthDate: 'Data nașterii nu poate fi citită. Corectați-o în Date.',
} as const;

export const ADMIN_ERRORS = {
  notFound: 'Nu a fost găsit.',
  stale: 'Datele s-au schimbat. Reîncarcă pagina.',
  nameRequired: 'Completați numele.',
  birthDate: 'Alegeți data nașterii.',
  invalid: 'Cerere invalidă.',
  failed: 'Acțiunea nu a reușit. Nimic nu a fost salvat.',
} as const;
```

`src/club/athlete-data.ts`:

```ts
import { changedFields, type FieldChange } from './admin-result';
import { ADMIN_ERRORS } from './athletes/errors';
import { isoDate, partsFromIso, readPickedDate, roDate } from './birth-date';
import { collapseSpaces } from './person-match';

/** The athlete's private data (spec 1.1, 6.2). One full name; birth date as ISO; empty = null. */
export type AthleteStatus = 'nou' | 'activ' | 'inactiv';
export const ATHLETE_STATUSES: readonly AthleteStatus[] = ['nou', 'activ', 'inactiv'];
export const ATHLETE_FIELDS = ['name', 'birthDate', 'contactName', 'phone', 'email'] as const;
export type AthleteField = (typeof ATHLETE_FIELDS)[number];
export type AthleteValues = { [K in AthleteField]: string | null };

/** Date tab labels (spec 6.2). */
export const ATHLETE_FIELD_LABELS: Record<AthleteField, string> = {
  name: 'Nume și prenume',
  birthDate: 'Data nașterii',
  contactName: 'Persoana de contact',
  phone: 'Telefon',
  email: 'E-mail',
};

/** The words of the hint "Obligatorii pentru "complet": nume, data nașterii, persoana de contact, telefon, e-mail." */
export const MISSING_FIELD_WORDS: Record<AthleteField, string> = {
  name: 'nume',
  birthDate: 'data nașterii',
  contactName: 'persoana de contact',
  phone: 'telefon',
  email: 'e-mail',
};

export const isAthleteField = (v: unknown): v is AthleteField => (ATHLETE_FIELDS as readonly unknown[]).includes(v);

export function pickAthleteValues(source: AthleteValues): AthleteValues {
  return { name: source.name, birthDate: source.birthDate, contactName: source.contactName, phone: source.phone, email: source.email };
}

export const missingFields = (v: AthleteValues): AthleteField[] => ATHLETE_FIELDS.filter((f) => !v[f]);
export const isDataIncomplete = (v: AthleteValues): boolean => missingFields(v).length > 0;
export const missingText = (fields: readonly AthleteField[]): string => fields.map((f) => MISSING_FIELD_WORDS[f]).join(', ');

export function athleteChanges(before: AthleteValues, after: AthleteValues): Record<string, FieldChange> {
  return changedFields(ATHLETE_FIELDS, before, after);
}

export function birthDateForPicker(iso: string | null): string | null {
  const parts = partsFromIso(iso);
  return parts ? roDate(parts) : null;
}

/** Display text of a stored value: birth date as ZZ.LL.AAAA, empty as blank. */
export function athleteValueText(field: AthleteField, value: string | null): string {
  return field === 'birthDate' ? birthDateForPicker(value) ?? '' : value ?? '';
}

export type AthleteInput = { ok: true; values: AthleteValues } | { ok: false; error: string };
type BirthRead = { ok: true; value: string | null } | { ok: false };

function readBirthDate(raw: unknown, required: boolean): BirthRead {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return required ? { ok: false } : { ok: true, value: null };
  const parts = readPickedDate(text);
  return parts ? { ok: true, value: isoDate(parts) } : { ok: false };
}

const textOrNull = (v: unknown) => collapseSpaces(v) || null;

/** The Date tab's "Editează" or the "Adaugă sportiv" form: name always required, birth date required when adding (gaps #41). */
export function readAthleteInput(body: unknown, mode: 'edit' | 'add'): AthleteInput {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const name = collapseSpaces(b.name);
  if (!name) return { ok: false, error: ADMIN_ERRORS.nameRequired };
  const birth = readBirthDate(b.birthDate, mode === 'add');
  if (birth.ok === false) return { ok: false, error: ADMIN_ERRORS.birthDate };
  return { ok: true, values: { name, birthDate: birth.value, contactName: textOrNull(b.contactName), phone: textOrNull(b.phone), email: textOrNull(b.email) } };
}
```

`src/club/profile-slug.ts`:

```ts
/** Web address of a public profile (spec 1.2): made once from the name, never changed afterwards. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'sportiv';
}

/** `base`, else `base-2`, `base-3` ... skipping every address in use (current and merged-away ones). */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club/__tests__/athlete-data.test.ts src/club/__tests__/profile-slug.test.ts && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/errors.ts src/club/athlete-data.ts src/club/profile-slug.ts src/club/__tests__/athlete-data.test.ts src/club/__tests__/profile-slug.test.ts
git commit -m "feat(club): athlete data rules, missing fields, profile slugs, refusal texts"
```

---

### Task 6: History texts

**Files:**
- Modify: `src/club/acs.ts` (append)
- Create: `src/club/history-text.ts`
- Test: `src/club/__tests__/history-text.test.ts`

**Interfaces:**
- Consumes: `AcsState` (`src/club/acs.ts`); `ATHLETE_FIELD_LABELS`, `athleteValueText`, `isAthleteField`, `AthleteStatus` (Task 5); `RELATIONSHIP_EDIT_OPTIONS` (`src/club/registration-panel.ts`).
- Produces:
  - in `acs.ts`: `ACS_WORDS: Record<AcsState, string>`, `isAcsState(v: unknown): v is AcsState`, `acsWord(state: unknown): string`
  - `SUBJECT = { registration: 'registration-submission', athlete: 'athlete' }`, `MIGRATION_ACTOR = 'migrare'`, `FORM_ACTOR = 'formular'`, `ARROW = '→'`
  - `HISTORY_ACTIONS` (action strings below), `PENDING_COPY` (plan item N2), `STATUS_WORDS`, `REGISTRATION_FIELD_LABELS`
  - `registrationValueText(key: string, value: unknown): string`, `quotedChange(label, from, to): string`
  - `historyTexts(action: string, changes: unknown, subjectType: string): string[]` (one entry may give several lines)
  - `actorLabel(actor: string, names: Readonly<Record<string, string>>): string`

The `changes` shape every writer uses, per action:

| action | subject | changes |
|---|---|---|
| `submitted` | registration | none |
| `updated` | registration, athlete | `{ fields: Record<string, { from, to }>, registrationNumber?: string }` (athlete: number of the registration it came from) |
| `document-rebuilt` | registration | `{ documents }` (exists) |
| `email-resent` | registration | `{ recipient, documents }` (exists) |
| `number-assigned` | registration | `{ registrationNumber }` (phase 1 and 2 migrations) |
| `confirmed` | registration | `{ athleteName, createdAthlete: boolean, groupName: string \| null }` |
| `confirmation-undone` | both | none |
| `school-moved` | registration | `{ schoolName }` |
| `created` | athlete | phase 1 rows: the created data (with `publicProfile`); "Adaugă sportiv": `{ fields }` |
| `created-from-profile` | athlete | `{ publicProfile }` |
| `created-from-registrations` | athlete | `{ registrations: { documentId, season, number }[] }` |
| `registration-confirmed` | athlete | `{ registrationNumber, groupName: string \| null }` |
| `group-added` | athlete | `{ groupName }` |
| `acs-changed` | athlete | `{ season, from: AcsState \| null, to: AcsState }` |
| `reactivated` | athlete | none |
| `status-changed` | athlete | `{ from, to }` |
| `registration-deleted` | athlete | `{ registrationNumber }` |
| `profile-created` | athlete | none |
| `profile-page` | athlete | `{ on: boolean }` |
| `merged` | athlete | `{ name }` |
| `deleted` | athlete | `{ name }` |
| `duplicate-dismissed` | athlete | `{ name }` |

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/history-text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { acsWord } from '../acs';
import { HISTORY_ACTIONS as A, PENDING_COPY, SUBJECT, actorLabel, historyTexts } from '../history-text';

const reg = (action: string, changes?: unknown) => historyTexts(action, changes, SUBJECT.registration);
const ath = (action: string, changes?: unknown) => historyTexts(action, changes, SUBJECT.athlete);

describe('registration lines (spec 1.6)', () => {
  it('submit, rebuild, resend', () => {
    expect(reg(A.submitted)).toEqual(['Înscriere înregistrată']);
    expect(reg(A.documentRebuilt, { documents: ['acord'] })).toEqual(['Document refăcut']);
    expect(reg(A.emailResent, { recipient: 'ana@example.com', documents: [] })).toEqual(['E-mail retrimis către ana@example.com']);
  });

  it('one line per edited field, with the form wording, old -> new, blanks blank', () => {
    expect(reg(A.updated, { fields: { phone: { from: '0722 111 22', to: '0722 111 222' }, relationship: { from: 'parinte', to: 'alta' }, membershipAnswer: { from: null, to: 'da' } } })).toEqual([
      'Telefon de contact: "0722 111 22" → "0722 111 222"',
      'Calitatea față de sportiv: "Părinte" → "Alta"',
      'Dorește să fie membru: "" → "Da"',
    ]);
  });

  it('reads the old migration rows', () => {
    expect(reg(A.updated, { season: { from: '2025–2026', to: '2025-2026' }, seasonRef: 'x' })).toEqual(['Sezon: "2025–2026" → "2025-2026"']);
    expect(reg(A.numberAssigned, { registrationNumber: '2026-0001' })).toEqual(['Nr. înscriere: "" → "2026-0001"']);
  });

  it('confirmation lines (proto v5)', () => {
    expect(reg(A.confirmed, { athleteName: 'Maria Pop', createdAthlete: false, groupName: 'Intermediari Bronze' })).toEqual([
      'Confirmat. Fișa existentă folosită (Maria Pop); grupa Intermediari Bronze.',
    ]);
    expect(reg(A.confirmed, { athleteName: 'Maria Pop', createdAthlete: true, groupName: null })).toEqual(['Confirmat. Sportiv nou creat; fără grupă.']);
    expect(reg(A.confirmationUndone)).toEqual(['Confirmare anulată']);
    expect(reg(A.schoolMoved, { schoolName: 'Patinoar 2' })).toEqual(['Mutată la Patinoar 2']);
  });

  it('archive uses the pending label (N2 c)', () => {
    expect(reg(A.updated, { fields: { archived: { from: false, to: true } } })).toEqual([`${PENDING_COPY.archivedLabel}: "Nu" → "Da"`]);
  });
});

describe('athlete lines (spec 1.6)', () => {
  it('creation', () => {
    expect(ath(A.created, { firstName: 'Maria', publicProfile: 'p1' })).toEqual(['Fișă creată din profilul public existent']);
    expect(ath(A.createdFromProfile, { publicProfile: 'p1' })).toEqual(['Fișă creată din profilul public existent']);
    expect(ath(A.createdFromRegistrations, { registrations: [] })).toEqual(['Fișă creată din înscrierile anterioare']);
    expect(ath(A.created, { fields: {} })).toEqual([PENDING_COPY.athleteCreated]);
  });

  it('confirmation and what it wrote', () => {
    expect(ath(A.registrationConfirmed, { registrationNumber: '2026-0142', groupName: 'Primii Pași' })).toEqual(['Înscriere confirmată: 2026-0142, grupa Primii Pași']);
    expect(ath(A.registrationConfirmed, { registrationNumber: '2026-0142', groupName: null })).toEqual(['Înscriere confirmată: 2026-0142']);
    expect(ath(A.updated, { fields: { phone: { from: '0722 111 22', to: '0722 111 222' } }, registrationNumber: '2026-0142' })).toEqual([
      'Telefon: "0722 111 22" → "0722 111 222" (din înscrierea 2026-0142)',
    ]);
    expect(ath(A.groupAdded, { groupName: 'Primii Pași' })).toEqual(['Adăugat în grupa Primii Pași']);
    expect(ath(A.acsChanged, { season: '2026-2027', from: null, to: 'in_asteptare' })).toEqual(['Membru A.C.S. 2026-2027: Nu → În așteptare']);
    expect(ath(A.reactivated)).toEqual(['Reactivat']);
  });

  it('edits, status, profile, merge, delete', () => {
    expect(ath(A.updated, { fields: { birthDate: { from: null, to: '2016-03-14' } } })).toEqual(['Data nașterii: "" → "14.03.2016"']);
    expect(ath(A.statusChanged, { from: 'activ', to: 'inactiv' })).toEqual(['Status: Activ → Inactiv']);
    expect(ath(A.registrationDeleted, { registrationNumber: '2026-0142' })).toEqual(['Înscriere ștearsă: 2026-0142']);
    expect(ath(A.profileCreated)).toEqual(['Profil public creat']);
    expect(ath(A.profilePage, { on: true })).toEqual(['Pagina publică pornită']);
    expect(ath(A.profilePage, { on: false })).toEqual(['Pagina publică oprită']);
    expect(ath(A.merged, { name: 'Maria D.' })).toEqual(['Unit cu Maria D.']);
    expect(ath(A.deleted, { name: 'Maria D.' })).toEqual(['Sportiv șters: Maria D.']);
    expect(ath(A.duplicateDismissed, { name: 'Maria D.' })).toEqual([PENDING_COPY.duplicateDismissed('Maria D.')]);
  });

  it('shows nothing for an unknown action', () => expect(ath('price-notes-updated', {})).toEqual([]));
});

describe('actor (3b Q23)', () => {
  it('by name, e-mail when no name, Migrare for the migration', () => {
    expect(actorLabel('ana@club.ro', { 'ana@club.ro': 'Ana Pop' })).toBe('Ana Pop');
    expect(actorLabel('ion@club.ro', {})).toBe('ion@club.ro');
    expect(actorLabel('migrare', {})).toBe('Migrare');
    expect(actorLabel('formular', {})).toBe(PENDING_COPY.formActor);
  });
});

describe('A.C.S. words', () => {
  it('no value reads as Nu', () => {
    expect(acsWord('da')).toBe('Da');
    expect(acsWord('in_asteptare')).toBe('În așteptare');
    expect(acsWord(null)).toBe('Nu');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/history-text.test.ts`
Expected: FAIL with "Cannot find module '../history-text'".

- [ ] **Step 3: Write the implementation**

Append to `src/club/acs.ts`:

```ts
/** The three A.C.S. states as shown (spec 5): no value reads as "Nu". */
export const ACS_WORDS: Record<AcsState, string> = { da: 'Da', nu: 'Nu', in_asteptare: 'În așteptare' };

export const isAcsState = (v: unknown): v is AcsState => v === 'da' || v === 'nu' || v === 'in_asteptare';

export function acsWord(state: unknown): string {
  return isAcsState(state) ? ACS_WORDS[state] : ACS_WORDS.nu;
}
```

`src/club/history-text.ts`:

```ts
import { acsWord } from './acs';
import { ATHLETE_FIELD_LABELS, athleteValueText, isAthleteField, type AthleteStatus } from './athlete-data';
import { RELATIONSHIP_EDIT_OPTIONS } from './registration-panel';

/** Istoric lines (spec 1.6): one line per change, old → new, newest first. Pure; the history read renders with it. */
export const SUBJECT = { registration: 'registration-submission', athlete: 'athlete' } as const;
export const MIGRATION_ACTOR = 'migrare';
export const FORM_ACTOR = 'formular';
export const ARROW = '→';

export const HISTORY_ACTIONS = {
  submitted: 'submitted',
  updated: 'updated',
  documentRebuilt: 'document-rebuilt',
  emailResent: 'email-resent',
  numberAssigned: 'number-assigned',
  confirmed: 'confirmed',
  confirmationUndone: 'confirmation-undone',
  schoolMoved: 'school-moved',
  created: 'created',
  createdFromProfile: 'created-from-profile',
  createdFromRegistrations: 'created-from-registrations',
  registrationConfirmed: 'registration-confirmed',
  groupAdded: 'group-added',
  acsChanged: 'acs-changed',
  reactivated: 'reactivated',
  statusChanged: 'status-changed',
  registrationDeleted: 'registration-deleted',
  profileCreated: 'profile-created',
  profilePage: 'profile-page',
  merged: 'merged',
  deleted: 'deleted',
  duplicateDismissed: 'duplicate-dismissed',
} as const;

/** Copy the spec does not give (plan item N2, option A until the user answers). */
export const PENDING_COPY = {
  athleteCreated: 'Fișă creată',
  duplicateDismissed: (name: string) => `Nu e același copil cu ${name}`,
  archivedLabel: 'Arhivată',
  formActor: '',
} as const;

export const STATUS_WORDS: Record<AthleteStatus, string> = { nou: 'Nou', activ: 'Activ', inactiv: 'Inactiv' };

/** Registration field labels: the form's wording (spec 3.3), the full table's for the other columns. */
export const REGISTRATION_FIELD_LABELS: Readonly<Record<string, string>> = {
  email: 'Adresă de e-mail',
  parentName: 'Persoana care completează',
  relationship: 'Calitatea față de sportiv',
  relationshipOther: 'Calitatea față de sportiv',
  phone: 'Telefon de contact',
  childName: 'Numele copilului',
  childBirthDate: 'Data nașterii copilului',
  childHeight: 'Înălțimea copilului (cm)',
  shirtSize: 'Măsura bluză',
  lastSeason: 'Sezonul trecut a participat la cursurile ACS EduSport?',
  priorExperience: 'Nivel de experiență / Elemente cunoscute',
  expectations: 'Așteptări de la cursurile de patinaj',
  membershipAnswer: 'Dorește să fie membru',
  level: 'Nivel',
  howHeard: 'Cum a aflat',
  clubInterest: 'Interes club',
  regulationsAgreement: 'Acord regulament',
  privacyConsent: 'Confidențialitate',
  internalNote: 'Notă internă',
  status: 'Status',
  season: 'Sezon',
  archived: PENDING_COPY.archivedLabel,
  registrationNumber: 'Nr. înscriere',
};

type Changes = Record<string, unknown>;
type Render = (c: Changes, subjectType: string) => string[];

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isChange = (v: unknown): v is { from: unknown; to: unknown } => isRecord(v) && 'from' in v && 'to' in v;
const statusWord = (v: unknown) => (typeof v === 'string' && v in STATUS_WORDS ? STATUS_WORDS[v as AthleteStatus] : '');

export const quotedChange = (label: string, from: string, to: string): string => `${label}: "${from}" ${ARROW} "${to}"`;

export function registrationValueText(key: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Da' : 'Nu';
  if (key === 'membershipAnswer') return value === 'da' ? 'Da' : value === 'nu' ? 'Nu' : text(value);
  if (key === 'relationship') return RELATIONSHIP_EDIT_OPTIONS.find((o) => o.value === value)?.label ?? text(value);
  return typeof value === 'object' ? '' : String(value);
}

function fieldLabel(subjectType: string, key: string): string | null {
  if (subjectType === SUBJECT.athlete) return isAthleteField(key) ? ATHLETE_FIELD_LABELS[key] : null;
  return REGISTRATION_FIELD_LABELS[key] ?? null;
}

function valueText(subjectType: string, key: string, value: unknown): string {
  if (subjectType === SUBJECT.athlete && isAthleteField(key)) return athleteValueText(key, typeof value === 'string' ? value : null);
  return registrationValueText(key, value);
}

function fieldLines(c: Changes, subjectType: string): string[] {
  const fields = isRecord(c.fields) ? c.fields : c;
  const fromRegistration = subjectType === SUBJECT.athlete && typeof c.registrationNumber === 'string';
  const suffix = fromRegistration ? ` (din înscrierea ${c.registrationNumber})` : '';
  return Object.entries(fields).flatMap(([key, change]) => {
    const label = fieldLabel(subjectType, key);
    if (!label || !isChange(change)) return [];
    return [quotedChange(label, valueText(subjectType, key, change.from), valueText(subjectType, key, change.to)) + suffix];
  });
}

function confirmedLine(c: Changes): string {
  const who = c.createdAthlete === true ? 'Sportiv nou creat' : `Fișa existentă folosită (${text(c.athleteName)})`;
  const group = c.groupName ? `grupa ${text(c.groupName)}` : 'fără grupă';
  return `Confirmat. ${who}; ${group}.`;
}

const PROFILE_LINE = 'Fișă creată din profilul public existent';
const confirmedOnAthlete = (c: Changes) =>
  c.groupName ? `Înscriere confirmată: ${text(c.registrationNumber)}, grupa ${text(c.groupName)}` : `Înscriere confirmată: ${text(c.registrationNumber)}`;

const RENDER: Readonly<Record<string, Render>> = {
  [HISTORY_ACTIONS.submitted]: () => ['Înscriere înregistrată'],
  [HISTORY_ACTIONS.updated]: fieldLines,
  [HISTORY_ACTIONS.documentRebuilt]: () => ['Document refăcut'],
  [HISTORY_ACTIONS.emailResent]: (c) => [`E-mail retrimis către ${text(c.recipient)}`],
  [HISTORY_ACTIONS.numberAssigned]: (c) => [quotedChange('Nr. înscriere', '', text(c.registrationNumber))],
  [HISTORY_ACTIONS.confirmed]: (c) => [confirmedLine(c)],
  [HISTORY_ACTIONS.confirmationUndone]: () => ['Confirmare anulată'],
  [HISTORY_ACTIONS.schoolMoved]: (c) => [`Mutată la ${text(c.schoolName)}`],
  [HISTORY_ACTIONS.created]: (c) => [c.publicProfile ? PROFILE_LINE : PENDING_COPY.athleteCreated],
  [HISTORY_ACTIONS.createdFromProfile]: () => [PROFILE_LINE],
  [HISTORY_ACTIONS.createdFromRegistrations]: () => ['Fișă creată din înscrierile anterioare'],
  [HISTORY_ACTIONS.registrationConfirmed]: (c) => [confirmedOnAthlete(c)],
  [HISTORY_ACTIONS.groupAdded]: (c) => [`Adăugat în grupa ${text(c.groupName)}`],
  [HISTORY_ACTIONS.acsChanged]: (c) => [`Membru A.C.S. ${text(c.season)}: ${acsWord(c.from)} ${ARROW} ${acsWord(c.to)}`],
  [HISTORY_ACTIONS.reactivated]: () => ['Reactivat'],
  [HISTORY_ACTIONS.statusChanged]: (c) => [`Status: ${statusWord(c.from)} ${ARROW} ${statusWord(c.to)}`],
  [HISTORY_ACTIONS.registrationDeleted]: (c) => [`Înscriere ștearsă: ${text(c.registrationNumber)}`],
  [HISTORY_ACTIONS.profileCreated]: () => ['Profil public creat'],
  [HISTORY_ACTIONS.profilePage]: (c) => [c.on === true ? 'Pagina publică pornită' : 'Pagina publică oprită'],
  [HISTORY_ACTIONS.merged]: (c) => [`Unit cu ${text(c.name)}`],
  [HISTORY_ACTIONS.deleted]: (c) => [`Sportiv șters: ${text(c.name)}`],
  [HISTORY_ACTIONS.duplicateDismissed]: (c) => [PENDING_COPY.duplicateDismissed(text(c.name))],
};

export function historyTexts(action: string, changes: unknown, subjectType: string): string[] {
  const render = RENDER[action];
  return render ? render(isRecord(changes) ? changes : {}, subjectType) : [];
}

/** Who, as Istoric shows it: the admin's name, else the e-mail; "Migrare" for migration rows (3b Q23). */
export function actorLabel(actor: string, names: Readonly<Record<string, string>>): string {
  if (actor === MIGRATION_ACTOR) return 'Migrare';
  if (actor === FORM_ACTOR) return PENDING_COPY.formActor;
  return names[actor] || actor;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/club/__tests__/history-text.test.ts src/club/__tests__/acs.test.ts && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/acs.ts src/club/history-text.ts src/club/__tests__/history-text.test.ts
git commit -m "feat(club): Istoric line texts for registrations and athletes"
```

---
### Task 7: Confirmation planner (season, comparison, plan, history)

**Files:**
- Modify: `src/club/acs.ts` (append `ACS_RANK`)
- Create: `src/club/confirm/season.ts`, `src/club/confirm/compare.ts`, `src/club/confirm/plan.ts`, `src/club/confirm/history.ts`
- Test: `src/club/confirm/__tests__/season.test.ts`, `src/club/confirm/__tests__/compare.test.ts`, `src/club/confirm/__tests__/plan.test.ts`

**Interfaces:**
- Consumes: `AcsState`, `changedFields`, `FieldChange`; Task 2 (`isoDate`, `parseBirthDate`, `DateParts`); Task 3 (`collapseSpaces`, `normalizePhone`, `normalizeEmail`); Task 5 (`ATHLETE_FIELDS`, `AthleteField`, `AthleteValues`, `AthleteStatus`, `isAthleteField`, `isDataIncomplete`, `pickAthleteValues`, `athleteValueText`, `CONFIRM_ERRORS`); Task 6 (`HISTORY_ACTIONS`, `SUBJECT`); `HistoryInput` (`src/club/history.ts`); `normalizeSeasonLabel` (`src/club/season.ts`).
- Produces:
  - `ACS_RANK: Record<AcsState, number>` (nu 0, in_asteptare 1, da 2)
  - `type SeasonFacts = { id: string; label: string; startMonth: string; endMonth: string }`; `registrationSeason(reg: { seasonId: string | null; season: string | null }, seasons: SeasonFacts[]): SeasonFacts | null`; `seasonRunning(season: SeasonFacts | null, today: DateParts): boolean`; `membershipFrom(season: SeasonFacts, today: DateParts): string`; `seasonEndedText(label: string): string`
  - `type RegistrationPerson = { childName: string; childBirthDate: string; parentName: string; phone: string; email: string }`; `type ComparisonRow = { field: AthleteField; label: string; athlete: string; registration: string; differs: boolean; defaultUpdate: boolean }`; `COMPARE_LABELS`; `registrationValues(r: RegistrationPerson): AthleteValues`; `comparisonRows(athlete: AthleteValues, r: RegistrationPerson): ComparisonRow[]`; `defaultUpdateFields(rows: ComparisonRow[]): AthleteField[]`
  - `type RegistrationStatus = 'Nou' | 'Contactat' | 'Confirmat' | 'Respins'`; `type ConfirmRequest = { choice: 'existing' | 'new'; athleteId: string | null; groupId: string | null; makeMain: boolean; updateFields: AthleteField[] | null }`; `type ConfirmationRecord` (below); `type ConfirmFacts`, `type ConfirmPlan` (below)
  - `readConfirmRequest(body: unknown): ConfirmRequest | null`; `canConfirm(r)`, `canUndo(r)`; `confirmRefusal(reg, request): { status: 400 | 409; error: string } | null`; `planConfirmation(f: ConfirmFacts): ConfirmPlan`; `confirmationRecord(input): ConfirmationRecord`
  - `confirmationHistory(input: { plan: ConfirmPlan; registrationId: string; registrationNumber: string; athleteId: string; athleteName: string; actor: string }): HistoryInput[]`

- [ ] **Step 1: Write the failing tests**

`src/club/confirm/__tests__/season.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { membershipFrom, registrationSeason, seasonEndedText, seasonRunning } from '../season';

const S25 = { id: 's25', label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31' };
const S26 = { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31' };
const d = (year: number, month: number, day: number) => ({ year, month, day });

describe("the registration's season (spec 4.3, gaps #31)", () => {
  it('uses the Sezon link, else the season text', () => {
    expect(registrationSeason({ seasonId: 's25', season: '2026-2027' }, [S25, S26])).toBe(S25);
    expect(registrationSeason({ seasonId: null, season: '2026–2027' }, [S25, S26])).toBe(S26);
  });

  it('is none when nothing matches (treated as ended)', () => {
    expect(registrationSeason({ seasonId: null, season: 'vara' }, [S25, S26])).toBeNull();
    expect(seasonRunning(null, d(2026, 10, 26))).toBe(false);
  });
});

describe('running up to the end month (r3 c9)', () => {
  it('runs through the whole end month, also before the start', () => {
    expect(seasonRunning(S26, d(2027, 5, 31))).toBe(true);
    expect(seasonRunning(S26, d(2027, 6, 1))).toBe(false);
    expect(seasonRunning(S26, d(2026, 9, 1))).toBe(true);
  });

  it('says it ended', () => {
    expect(seasonEndedText('2026-2027')).toBe('Sezonul 2026-2027 s-a încheiat. Se leagă doar fișa sportivului.');
  });
});

describe('membership start (gaps #29)', () => {
  it('is the confirmation date, or the season start when confirmed before it', () => {
    expect(membershipFrom(S26, d(2026, 10, 26))).toBe('2026-10-26');
    expect(membershipFrom(S26, d(2026, 9, 15))).toBe('2026-10-01');
  });
});
```

`src/club/confirm/__tests__/compare.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AthleteValues } from '../../athlete-data';
import { comparisonRows, defaultUpdateFields, registrationValues } from '../compare';

const reg = { childName: ' Maria  Pop ', childBirthDate: '14.03.2016', parentName: 'Ana Pop', phone: '0722 111 222', email: 'ana@example.com' };
const athlete = (over: Partial<AthleteValues> = {}): AthleteValues => ({
  name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722111222', email: 'ana@example.com', ...over,
});

describe('registrationValues', () => {
  it('turns the answers into athlete values', () => {
    expect(registrationValues(reg)).toEqual({ name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722 111 222', email: 'ana@example.com' });
  });
});

describe('Compară și actualizează (spec 4.2)', () => {
  it('rows Nume, Data nașterii, Părinte, Telefon, E-mail; phone and e-mail compared normalised', () => {
    const rows = comparisonRows(athlete({ email: 'ANA@example.com' }), reg);
    expect(rows.map((r) => [r.label, r.differs])).toEqual([
      ['Nume', false], ['Data nașterii', false], ['Părinte', false], ['Telefon', false], ['E-mail', false],
    ]);
  });

  it('ticks every differing field by default except name and birth date', () => {
    const rows = comparisonRows(athlete({ name: 'Maria Popa', birthDate: '2016-03-15', contactName: 'Ion Pop', phone: '0733000000' }), reg);
    expect(rows.filter((r) => r.differs).map((r) => r.field)).toEqual(['name', 'birthDate', 'contactName', 'phone']);
    expect(defaultUpdateFields(rows)).toEqual(['contactName', 'phone']);
  });

  it('shows dates as ZZ.LL.AAAA, an unreadable one as typed, and empty cells blank', () => {
    const rows = comparisonRows(athlete({ contactName: null }), { ...reg, childBirthDate: 'martie 2016' });
    expect(rows[1]).toMatchObject({ athlete: '14.03.2016', registration: 'martie 2016', differs: true });
    expect(rows[2]).toMatchObject({ athlete: '', registration: 'Ana Pop', defaultUpdate: true });
  });

  it('never ticks by default an empty registration value (N3)', () => {
    const rows = comparisonRows(athlete(), { ...reg, email: '' });
    expect(rows[4]).toMatchObject({ differs: true, defaultUpdate: false });
  });
});
```

`src/club/confirm/__tests__/plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AthleteValues } from '../../athlete-data';
import { CONFIRM_ERRORS } from '../../athletes/errors';
import { confirmationHistory } from '../history';
import {
  canConfirm,
  canUndo,
  confirmRefusal,
  confirmationRecord,
  planConfirmation,
  readConfirmRequest,
  type ConfirmFacts,
  type ConfirmRequest,
} from '../plan';

const values = (over: Partial<AthleteValues> = {}): AthleteValues => ({
  name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722111222', email: 'ana@example.com', ...over,
});
const SEASON = { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31' };
const facts = (over: Partial<ConfirmFacts> = {}): ConfirmFacts => ({
  registration: { id: 'r1', number: '2026-0142', status: 'Nou', membershipAnswer: 'da', values: values() },
  athlete: null,
  season: SEASON,
  running: true,
  today: { year: 2026, month: 10, day: 26 },
  seasonMemberships: [],
  seasonAcs: null,
  group: { id: 'g-pp', name: 'Primii Pași' },
  makeMain: false,
  updateFields: [],
  ...over,
});
const existing = (over: Partial<AthleteValues & { status: 'nou' | 'activ' | 'inactiv' }> = {}) => ({ id: 'a1', status: 'activ' as const, ...values({ phone: '0711000000' }), ...over });

describe('Sportiv nou (spec 4.5)', () => {
  it('creates the athlete activ from the registration, adds the group as main, sets A.C.S. În așteptare', () => {
    const plan = planConfirmation(facts());
    expect(plan.newAthlete).toEqual({ ...values(), status: 'activ', dataIncomplete: false });
    expect(plan.membership).toEqual({ groupId: 'g-pp', seasonId: 's26', isMain: true, from: '2026-10-26' });
    expect(plan.acs).toEqual({ existingId: null, seasonId: 's26', seasonLabel: '2026-2027', from: null, to: 'in_asteptare' });
    expect(plan.groupName).toBe('Primii Pași');
  });

  it('marks "Date incomplete" when the registration lacks a field', () => {
    expect(planConfirmation(facts({ registration: { ...facts().registration, values: values({ email: null }) } })).newAthlete?.dataIncomplete).toBe(true);
  });

  it('season ended: links only, no group, no A.C.S. (r3b c9)', () => {
    const plan = planConfirmation(facts({ running: false }));
    expect([plan.membership, plan.acs, plan.groupName]).toEqual([null, null, null]);
    expect(plan.newAthlete).not.toBeNull();
  });

  it('no group picked: "Fără grupă deocamdată"', () => {
    expect(planConfirmation(facts({ group: null })).membership).toBeNull();
  });
});

describe('Sportiv existent (spec 4.5)', () => {
  it('applies only the ticked fields and recomputes "Date incomplete"', () => {
    const plan = planConfirmation(facts({ athlete: existing({ email: null }), updateFields: ['phone'] }));
    expect(plan.athleteUpdate).toEqual({ phone: '0722111222', dataIncomplete: true });
    expect(plan.fieldChanges).toEqual({ phone: { from: '0711000000', to: '0722111222' } });
    expect([plan.newAthlete, plan.statusChange, plan.renameProfile]).toEqual([null, null, null]);
  });

  it('reactivates an inactive athlete and makes a "nou" one activ (r4 e7)', () => {
    expect(planConfirmation(facts({ athlete: existing({ status: 'inactiv' }) })).statusChange).toEqual({ from: 'inactiv', to: 'activ' });
    const plan = planConfirmation(facts({ athlete: existing({ status: 'nou' }) }));
    expect([plan.statusChange, plan.athleteUpdate?.status]).toEqual([{ from: 'nou', to: 'activ' }, 'activ']);
  });

  it('a ticked name renames the public profile (spec 4.2)', () => {
    expect(planConfirmation(facts({ athlete: existing({ name: 'Maria Popa' }), updateFields: ['name'] })).renameProfile).toBe('Maria Pop');
  });

  it('keeps the current main group unless "Grupă principală" is ticked (r3b c8)', () => {
    const own = [{ id: 'm1', groupId: 'g-pro', isMain: true }];
    expect(planConfirmation(facts({ athlete: existing(), seasonMemberships: own }))).toMatchObject({ membership: { isMain: false }, demoteMainId: null });
    expect(planConfirmation(facts({ athlete: existing(), seasonMemberships: own, makeMain: true }))).toMatchObject({ membership: { isMain: true }, demoteMainId: 'm1' });
  });

  it('writes nothing twice: a group or A.C.S. already there stays (r4 e5)', () => {
    const plan = planConfirmation(facts({ athlete: existing(), seasonMemberships: [{ id: 'm1', groupId: 'g-pp', isMain: true }], seasonAcs: { id: 'x', state: 'in_asteptare' } }));
    expect([plan.membership, plan.demoteMainId, plan.acs, plan.groupName]).toEqual([null, null, null, 'Primii Pași']);
  });
});

describe('A.C.S. (spec 1.4, gaps #30, N8)', () => {
  it('never lowers Da; raises Nu to În așteptare', () => {
    expect(planConfirmation(facts({ athlete: existing(), seasonAcs: { id: 'x', state: 'da' } })).acs).toBeNull();
    expect(planConfirmation(facts({ athlete: existing(), seasonAcs: { id: 'x', state: 'nu' } })).acs).toMatchObject({ existingId: 'x', from: 'nu', to: 'in_asteptare' });
  });

  it('wish Nu, or no wish on an old registration, writes nothing', () => {
    expect(planConfirmation(facts({ registration: { ...facts().registration, membershipAnswer: 'nu' } })).acs).toBeNull();
    expect(planConfirmation(facts({ registration: { ...facts().registration, membershipAnswer: null } })).acs).toBeNull();
  });
});

describe('what the undo needs', () => {
  it('records the old and new values, the rows written and the status before', () => {
    const f = facts({ athlete: existing({ status: 'inactiv' }), updateFields: ['phone'], seasonMemberships: [{ id: 'm0', groupId: 'g-pro', isMain: true }], makeMain: true });
    const plan = planConfirmation(f);
    expect(confirmationRecord({ plan, facts: f, athleteId: 'a1', membershipId: 'm9', acsId: 'c9', at: '2026-10-26T10:00:00.000Z' })).toEqual({
      athleteId: 'a1',
      createdAthlete: false,
      previousStatus: 'Nou',
      athleteStatusBefore: 'inactiv',
      fieldsBefore: { phone: '0711000000' },
      fieldsAfter: { phone: '0722111222' },
      membershipId: 'm9',
      demotedMainId: 'm0',
      acs: { id: 'c9', previous: null },
      at: '2026-10-26T10:00:00.000Z',
    });
  });
});

describe('history on both records (spec 1.6)', () => {
  it('writes the confirmation, the field updates, the group, A.C.S. and the reactivation', () => {
    const plan = planConfirmation(facts({ athlete: existing({ status: 'inactiv' }), updateFields: ['phone'] }));
    const entries = confirmationHistory({ plan, registrationId: 'r1', registrationNumber: '2026-0142', athleteId: 'a1', athleteName: 'Maria Pop', actor: 'ana@club.ro' });
    expect(entries.map((e) => [e.subjectType, e.action])).toEqual([
      ['registration-submission', 'confirmed'],
      ['athlete', 'registration-confirmed'],
      ['athlete', 'updated'],
      ['athlete', 'group-added'],
      ['athlete', 'acs-changed'],
      ['athlete', 'reactivated'],
    ]);
    expect(entries[0].changes).toEqual({ athleteName: 'Maria Pop', createdAthlete: false, groupName: 'Primii Pași' });
    expect(entries[2].changes).toEqual({ fields: { phone: { from: '0711000000', to: '0722111222' } }, registrationNumber: '2026-0142' });
  });

  it('a "nou" athlete gets a status line instead of "Reactivat"', () => {
    const plan = planConfirmation(facts({ athlete: existing({ status: 'nou' }), running: false }));
    const entries = confirmationHistory({ plan, registrationId: 'r1', registrationNumber: '2026-0142', athleteId: 'a1', athleteName: 'Maria Pop', actor: 'a' });
    expect(entries.map((e) => e.action)).toEqual(['confirmed', 'registration-confirmed', 'status-changed']);
  });
});

describe('request and refusals (spec 4.7, 3.5)', () => {
  const request: ConfirmRequest = { choice: 'existing', athleteId: 'a1', groupId: null, makeMain: false, updateFields: null };
  const reg = { status: 'Nou' as const, archived: false, athleteId: null, childBirthDate: '14.03.2016' };

  it('reads the body', () => {
    expect(readConfirmRequest({ choice: 'existing', athleteId: ' a1 ', groupId: '', updateFields: ['phone', 'x'], makeMain: true })).toEqual({
      choice: 'existing', athleteId: 'a1', groupId: null, makeMain: true, updateFields: ['phone'],
    });
    expect(readConfirmRequest({ choice: 'new', athleteId: 'a1' })).toMatchObject({ athleteId: null, updateFields: null });
    expect(readConfirmRequest({ choice: 'maybe' })).toBeNull();
  });

  it('refuses a second confirmation, Respins, archived, an unreadable date, a missing athlete', () => {
    expect(confirmRefusal({ ...reg, athleteId: 'a9' }, request)).toEqual({ status: 409, error: CONFIRM_ERRORS.taken });
    expect(confirmRefusal({ ...reg, status: 'Respins' }, request)).toEqual({ status: 400, error: CONFIRM_ERRORS.failed });
    expect(confirmRefusal({ ...reg, archived: true }, request)).toEqual({ status: 400, error: CONFIRM_ERRORS.failed });
    expect(confirmRefusal({ ...reg, childBirthDate: 'martie' }, request)).toEqual({ status: 400, error: CONFIRM_ERRORS.birthDate });
    expect(confirmRefusal(reg, { ...request, athleteId: null })).toEqual({ status: 400, error: CONFIRM_ERRORS.failed });
    expect(confirmRefusal({ ...reg, status: 'Confirmat' }, request)).toBeNull();
  });

  it('offers the undo only on a registration confirmed through the window', () => {
    const record = { athleteId: 'a1' } as Parameters<typeof canUndo>[0]['confirmation'];
    expect(canUndo({ athleteId: 'a1', confirmation: record })).toBe(true);
    expect(canUndo({ athleteId: 'a1', confirmation: null })).toBe(false);
    expect(canConfirm({ ...reg })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/confirm`
Expected: FAIL with "Cannot find module '../season'" (and the others).

- [ ] **Step 3: Write the implementation**

Append to `src/club/acs.ts`:

```ts
/** Da > În așteptare > Nu (spec 6.6); a confirmation never lowers a status (spec 1.4). */
export const ACS_RANK: Record<AcsState, number> = { nu: 0, in_asteptare: 1, da: 2 };
```

`src/club/confirm/season.ts`:

```ts
import { isoDate, type DateParts } from '../birth-date';
import { normalizeSeasonLabel } from '../season';

export type SeasonFacts = { id: string; label: string; startMonth: string; endMonth: string };

/** The Sezon link, else the Sezon named by the season text; null when none (treated as ended, gaps #31). */
export function registrationSeason(reg: { seasonId: string | null; season: string | null }, seasons: SeasonFacts[]): SeasonFacts | null {
  const linked = reg.seasonId ? seasons.find((s) => s.id === reg.seasonId) : undefined;
  if (linked) return linked;
  const label = normalizeSeasonLabel(reg.season);
  return label ? seasons.find((s) => s.label === label) ?? null : null;
}

/** Running up to and including its end month (r3 c9); a season not started yet counts as running. */
export function seasonRunning(season: SeasonFacts | null, today: DateParts): boolean {
  return season !== null && isoDate(today).slice(0, 7) <= season.endMonth.slice(0, 7);
}

/** Group membership start (gaps #29): the confirmation date, or the season start when confirmed before it. */
export function membershipFrom(season: SeasonFacts, today: DateParts): string {
  const day = isoDate(today);
  const start = season.startMonth.slice(0, 10);
  return day < start ? start : day;
}

export const seasonEndedText = (label: string): string => `Sezonul ${label} s-a încheiat. Se leagă doar fișa sportivului.`;
```

`src/club/confirm/compare.ts`:

```ts
import { ATHLETE_FIELDS, athleteValueText, type AthleteField, type AthleteValues } from '../athlete-data';
import { isoDate, parseBirthDate } from '../birth-date';
import { collapseSpaces, normalizeEmail, normalizePhone } from '../person-match';

/** "Compară" (panel) and "Compară și actualizează" (window), spec 3.3 and 4.2. */
export type RegistrationPerson = { childName: string; childBirthDate: string; parentName: string; phone: string; email: string };
export type ComparisonRow = { field: AthleteField; label: string; athlete: string; registration: string; differs: boolean; defaultUpdate: boolean };

export const COMPARE_LABELS: Record<AthleteField, string> = { name: 'Nume', birthDate: 'Data nașterii', contactName: 'Părinte', phone: 'Telefon', email: 'E-mail' };
const NEVER_BY_DEFAULT: readonly AthleteField[] = ['name', 'birthDate'];

export function registrationValues(r: RegistrationPerson): AthleteValues {
  const birth = parseBirthDate(r.childBirthDate);
  return {
    name: collapseSpaces(r.childName) || null,
    birthDate: birth ? isoDate(birth) : null,
    contactName: collapseSpaces(r.parentName) || null,
    phone: collapseSpaces(r.phone) || null,
    email: collapseSpaces(r.email) || null,
  };
}

function differs(field: AthleteField, a: string | null, b: string | null): boolean {
  if (field === 'phone') return normalizePhone(a) !== normalizePhone(b);
  if (field === 'email') return normalizeEmail(a) !== normalizeEmail(b);
  return (a ?? '') !== (b ?? '');
}

function registrationText(field: AthleteField, r: RegistrationPerson, values: AthleteValues): string {
  if (field === 'birthDate' && !values.birthDate) return collapseSpaces(r.childBirthDate);
  return athleteValueText(field, values[field]);
}

/** Ticked by default: every differing field except name and birth date, and never an empty registration value (N3). */
export function comparisonRows(athlete: AthleteValues, r: RegistrationPerson): ComparisonRow[] {
  const values = registrationValues(r);
  return ATHLETE_FIELDS.map((field) => {
    const differ = differs(field, athlete[field], values[field]);
    return {
      field,
      label: COMPARE_LABELS[field],
      athlete: athleteValueText(field, athlete[field]),
      registration: registrationText(field, r, values),
      differs: differ,
      defaultUpdate: differ && !NEVER_BY_DEFAULT.includes(field) && values[field] !== null,
    };
  });
}

export const defaultUpdateFields = (rows: ComparisonRow[]): AthleteField[] => rows.filter((r) => r.defaultUpdate).map((r) => r.field);
```

`src/club/confirm/plan.ts`:

```ts
import { ACS_RANK, type AcsState } from '../acs';
import { changedFields, type FieldChange } from '../admin-result';
import {
  ATHLETE_FIELDS,
  isAthleteField,
  isDataIncomplete,
  pickAthleteValues,
  type AthleteField,
  type AthleteStatus,
  type AthleteValues,
} from '../athlete-data';
import { CONFIRM_ERRORS } from '../athletes/errors';
import { parseBirthDate, type DateParts } from '../birth-date';
import { membershipFrom, type SeasonFacts } from './season';

/** "Confirmă înscrierea" (spec 4.5 to 4.7): what one confirmation writes, decided before anything is written. */
export type RegistrationStatus = 'Nou' | 'Contactat' | 'Confirmat' | 'Respins';
export type ConfirmChoice = 'existing' | 'new';
export type ConfirmRequest = { choice: ConfirmChoice; athleteId: string | null; groupId: string | null; makeMain: boolean; updateFields: AthleteField[] | null };

/** Stored on the registration (json `confirmation`): exactly what the undo reverts. */
export type ConfirmationRecord = {
  athleteId: string;
  createdAthlete: boolean;
  previousStatus: RegistrationStatus;
  athleteStatusBefore: AthleteStatus | null;
  fieldsBefore: Partial<AthleteValues>;
  fieldsAfter: Partial<AthleteValues>;
  membershipId: string | null;
  demotedMainId: string | null;
  acs: { id: string; previous: AcsState | null } | null;
  at: string;
};

export type ConfirmFacts = {
  registration: { id: string; number: string; status: RegistrationStatus; membershipAnswer: 'da' | 'nu' | null; values: AthleteValues };
  athlete: (AthleteValues & { id: string; status: AthleteStatus }) | null;
  season: SeasonFacts | null;
  running: boolean;
  today: DateParts;
  seasonMemberships: { id: string; groupId: string; isMain: boolean }[];
  seasonAcs: { id: string; state: AcsState } | null;
  group: { id: string; name: string } | null;
  makeMain: boolean;
  updateFields: AthleteField[];
};

export type AthletePlan = {
  newAthlete: (AthleteValues & { status: 'activ'; dataIncomplete: boolean }) | null;
  athleteUpdate: (Partial<AthleteValues> & { status?: AthleteStatus; dataIncomplete: boolean }) | null;
  fieldChanges: Record<string, FieldChange>;
  statusChange: { from: AthleteStatus; to: 'activ' } | null;
  renameProfile: string | null;
};
export type MembershipPlan = { membership: { groupId: string; seasonId: string; isMain: boolean; from: string } | null; demoteMainId: string | null };
export type AcsPlan = { existingId: string | null; seasonId: string; seasonLabel: string; from: AcsState | null; to: AcsState } | null;
export type ConfirmPlan = AthletePlan & MembershipPlan & { acs: AcsPlan; groupName: string | null };

const asId = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function readConfirmRequest(body: unknown): ConfirmRequest | null {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (b.choice !== 'existing' && b.choice !== 'new') return null;
  const updateFields = Array.isArray(b.updateFields) ? b.updateFields.filter(isAthleteField) : null;
  return { choice: b.choice, athleteId: b.choice === 'existing' ? asId(b.athleteId) : null, groupId: asId(b.groupId), makeMain: b.makeMain === true, updateFields };
}

export const canConfirm = (r: { athleteId: string | null; status: RegistrationStatus; archived: boolean }): boolean =>
  r.athleteId === null && r.status !== 'Respins' && !r.archived;

export const canUndo = (r: { athleteId: string | null; confirmation: ConfirmationRecord | null }): boolean =>
  r.athleteId !== null && r.confirmation?.athleteId === r.athleteId;

type RefusalInput = { athleteId: string | null; status: RegistrationStatus; archived: boolean; childBirthDate: string };

export function confirmRefusal(reg: RefusalInput, request: ConfirmRequest): { status: 400 | 409; error: string } | null {
  if (reg.athleteId) return { status: 409, error: CONFIRM_ERRORS.taken };
  if (!canConfirm(reg)) return { status: 400, error: CONFIRM_ERRORS.failed };
  if (!parseBirthDate(reg.childBirthDate)) return { status: 400, error: CONFIRM_ERRORS.birthDate };
  return request.choice === 'existing' && !request.athleteId ? { status: 400, error: CONFIRM_ERRORS.failed } : null;
}

function planNew(values: AthleteValues): AthletePlan {
  return { newAthlete: { ...values, status: 'activ', dataIncomplete: isDataIncomplete(values) }, athleteUpdate: null, fieldChanges: {}, statusChange: null, renameProfile: null };
}

function changedOnly(changes: Record<string, FieldChange>, values: AthleteValues): Partial<AthleteValues> {
  const out: Partial<AthleteValues> = {};
  for (const key of Object.keys(changes)) if (isAthleteField(key)) out[key] = values[key];
  return out;
}

function planExisting(f: ConfirmFacts, athlete: NonNullable<ConfirmFacts['athlete']>): AthletePlan {
  const before = pickAthleteValues(athlete);
  const after = { ...before };
  for (const field of f.updateFields) after[field] = f.registration.values[field];
  const fieldChanges = changedFields(ATHLETE_FIELDS, before, after);
  const statusChange = athlete.status === 'activ' ? null : { from: athlete.status, to: 'activ' as const };
  const athleteUpdate = { ...changedOnly(fieldChanges, after), dataIncomplete: isDataIncomplete(after), ...(statusChange ? { status: 'activ' as const } : {}) };
  return { newAthlete: null, athleteUpdate, fieldChanges, statusChange, renameProfile: 'name' in fieldChanges ? after.name : null };
}

function planMembership(f: ConfirmFacts, season: SeasonFacts | null): MembershipPlan {
  const group = f.group;
  if (!season || !group || f.seasonMemberships.some((m) => m.groupId === group.id)) return { membership: null, demoteMainId: null };
  const first = f.seasonMemberships.length === 0;
  const isMain = first || f.makeMain;
  const currentMain = f.seasonMemberships.find((m) => m.isMain);
  return {
    membership: { groupId: group.id, seasonId: season.id, isMain, from: membershipFrom(season, f.today) },
    demoteMainId: isMain && currentMain ? currentMain.id : null,
  };
}

/** Wish "Da" writes "În așteptare"; wish "Nu" or no wish (N8) writes nothing; never lowers, never twice. */
function planAcs(f: ConfirmFacts, season: SeasonFacts | null): AcsPlan {
  if (!season || f.registration.membershipAnswer !== 'da') return null;
  const from = f.seasonAcs?.state ?? null;
  if (from !== null && ACS_RANK[from] >= ACS_RANK.in_asteptare) return null;
  return { existingId: f.seasonAcs?.id ?? null, seasonId: season.id, seasonLabel: season.label, from, to: 'in_asteptare' };
}

export function planConfirmation(f: ConfirmFacts): ConfirmPlan {
  const season = f.running ? f.season : null;
  const athlete = f.athlete ? planExisting(f, f.athlete) : planNew(f.registration.values);
  return { ...athlete, ...planMembership(f, season), acs: planAcs(f, season), groupName: season && f.group ? f.group.name : null };
}

function sideOf(changes: Record<string, FieldChange>, side: 'from' | 'to'): Partial<AthleteValues> {
  const out: Partial<AthleteValues> = {};
  for (const [key, change] of Object.entries(changes)) {
    const value = change[side];
    if (isAthleteField(key)) out[key] = typeof value === 'string' ? value : null;
  }
  return out;
}

export type RecordInput = { plan: ConfirmPlan; facts: ConfirmFacts; athleteId: string; membershipId: string | null; acsId: string | null; at: string };

export function confirmationRecord({ plan, facts, athleteId, membershipId, acsId, at }: RecordInput): ConfirmationRecord {
  return {
    athleteId,
    createdAthlete: plan.newAthlete !== null,
    previousStatus: facts.registration.status,
    athleteStatusBefore: facts.athlete?.status ?? null,
    fieldsBefore: sideOf(plan.fieldChanges, 'from'),
    fieldsAfter: sideOf(plan.fieldChanges, 'to'),
    membershipId,
    demotedMainId: plan.demoteMainId,
    acs: plan.acs && acsId ? { id: acsId, previous: plan.acs.from } : null,
    at,
  };
}
```

`src/club/confirm/history.ts`:

```ts
import type { HistoryInput } from '../history';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import type { ConfirmPlan } from './plan';

type Input = { plan: ConfirmPlan; registrationId: string; registrationNumber: string; athleteId: string; athleteName: string; actor: string };
type OnAthlete = (action: string, changes?: Record<string, unknown>) => HistoryInput;

function statusEntries(plan: ConfirmPlan, onAthlete: OnAthlete): HistoryInput[] {
  if (!plan.statusChange) return [];
  if (plan.statusChange.from === 'inactiv') return [onAthlete(HISTORY_ACTIONS.reactivated)];
  return [onAthlete(HISTORY_ACTIONS.statusChanged, { from: plan.statusChange.from, to: 'activ' })];
}

/** Spec 1.6: one confirmation line on the registration, then the athlete's lines in the order they happened. */
export function confirmationHistory(input: Input): HistoryInput[] {
  const { plan, actor } = input;
  const onAthlete: OnAthlete = (action, changes) => ({ subjectType: SUBJECT.athlete, subjectId: input.athleteId, action, changes, actor });
  const entries: HistoryInput[] = [
    { subjectType: SUBJECT.registration, subjectId: input.registrationId, action: HISTORY_ACTIONS.confirmed, actor, changes: { athleteName: input.athleteName, createdAthlete: plan.newAthlete !== null, groupName: plan.groupName } },
    onAthlete(HISTORY_ACTIONS.registrationConfirmed, { registrationNumber: input.registrationNumber, groupName: plan.groupName }),
  ];
  if (Object.keys(plan.fieldChanges).length) entries.push(onAthlete(HISTORY_ACTIONS.updated, { fields: plan.fieldChanges, registrationNumber: input.registrationNumber }));
  if (plan.membership) entries.push(onAthlete(HISTORY_ACTIONS.groupAdded, { groupName: plan.groupName }));
  if (plan.acs) entries.push(onAthlete(HISTORY_ACTIONS.acsChanged, { season: plan.acs.seasonLabel, from: plan.acs.from, to: plan.acs.to }));
  return [...entries, ...statusEntries(plan, onAthlete)];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club/confirm src/club/__tests__/acs.test.ts && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/acs.ts src/club/confirm
git commit -m "feat(club): confirmation planner, comparison table, season rules, confirmation history"
```

---

### Task 8: Undo planner

**Files:**
- Create: `src/club/confirm/undo-plan.ts`
- Test: `src/club/confirm/__tests__/undo-plan.test.ts`

**Interfaces:**
- Consumes: `ConfirmationRecord`, `RegistrationStatus` (Task 7); `AthleteValues`, `AthleteStatus`, `ATHLETE_FIELDS`, `isAthleteField`, `isDataIncomplete`, `pickAthleteValues` (Task 5); `changedFields`, `FieldChange`; `AcsState`.
- Produces:
  - `type UndoFacts = { record: ConfirmationRecord; linkedAthleteId: string | null; athlete: AthleteValues & { id: string; status: AthleteStatus; profileId: string | null }; membershipIds: string[]; acsRows: { id: string; state: AcsState }[]; otherRegistrations: number }`
  - `type UndoPlan = { registration: { status: RegistrationStatus }; deleteMembershipId: string | null; restoreMainId: string | null; acs: { op: 'delete'; id: string } | { op: 'set'; id: string; state: AcsState } | null; athleteUpdate: (Partial<AthleteValues> & { status?: AthleteStatus; dataIncomplete: boolean }) | null; revertedFields: Record<string, FieldChange>; renameProfile: string | null; deleteAthlete: boolean }`
  - `undoAllowed(record: ConfirmationRecord, linkedAthleteId: string | null, athleteId: string | null): boolean`, `planUndo(f: UndoFacts): UndoPlan`

- [ ] **Step 1: Write the failing test**

`src/club/confirm/__tests__/undo-plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ConfirmationRecord } from '../plan';
import { planUndo, undoAllowed, type UndoFacts } from '../undo-plan';

const record = (over: Partial<ConfirmationRecord> = {}): ConfirmationRecord => ({
  athleteId: 'a1',
  createdAthlete: false,
  previousStatus: 'Contactat',
  athleteStatusBefore: 'inactiv',
  fieldsBefore: { phone: '0711000000' },
  fieldsAfter: { phone: '0722111222' },
  membershipId: 'm9',
  demotedMainId: 'm0',
  acs: { id: 'c9', previous: null },
  at: '2026-10-26T10:00:00.000Z',
  ...over,
});
const facts = (over: Partial<UndoFacts> = {}): UndoFacts => ({
  record: record(),
  linkedAthleteId: 'a1',
  athlete: { id: 'a1', status: 'activ', profileId: null, name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722111222', email: null },
  membershipIds: ['m0', 'm9'],
  acsRows: [{ id: 'c9', state: 'in_asteptare' }],
  otherRegistrations: 0,
  ...over,
});

describe('undo reverts what the confirmation wrote (spec 4.6, gaps #32)', () => {
  it('link, status, group, main group, A.C.S., fields and reactivation', () => {
    expect(planUndo(facts())).toEqual({
      registration: { status: 'Contactat' },
      deleteMembershipId: 'm9',
      restoreMainId: 'm0',
      acs: { op: 'delete', id: 'c9' },
      athleteUpdate: { phone: '0711000000', status: 'inactiv', dataIncomplete: true },
      revertedFields: { phone: { from: '0722111222', to: '0711000000' } },
      renameProfile: null,
      deleteAthlete: false,
    });
  });

  it('keeps a field the admin changed after the confirmation', () => {
    const plan = planUndo(facts({ athlete: { ...facts().athlete, phone: '0799999999' } }));
    expect(plan.revertedFields).toEqual({});
    expect(plan.athleteUpdate).toEqual({ status: 'inactiv', dataIncomplete: true });
  });

  it('sets a raised A.C.S. back, but never lowers one paid in between', () => {
    expect(planUndo(facts({ record: record({ acs: { id: 'c9', previous: 'nu' } }) })).acs).toEqual({ op: 'set', id: 'c9', state: 'nu' });
    expect(planUndo(facts({ acsRows: [{ id: 'c9', state: 'da' }] })).acs).toBeNull();
  });

  it('renames the profile back when the name is reverted', () => {
    const plan = planUndo(facts({
      record: record({ fieldsBefore: { name: 'Maria Popa' }, fieldsAfter: { name: 'Maria Pop' } }),
      athlete: { ...facts().athlete, profileId: 'sp1' },
    }));
    expect(plan.renameProfile).toBe('Maria Popa');
  });
});

describe('a "Sportiv nou" record', () => {
  const created = record({ createdAthlete: true, athleteStatusBefore: null, fieldsBefore: {}, fieldsAfter: {}, demotedMainId: null });

  it('is removed when it has nothing else', () => {
    const plan = planUndo(facts({ record: created, membershipIds: ['m9'] }));
    expect([plan.deleteAthlete, plan.athleteUpdate, plan.deleteMembershipId]).toEqual([true, null, 'm9']);
  });

  it('stays when it has another registration, group, A.C.S. status or a public profile (N9)', () => {
    expect(planUndo(facts({ record: created, membershipIds: ['m9'], otherRegistrations: 1 })).deleteAthlete).toBe(false);
    expect(planUndo(facts({ record: created, membershipIds: ['m9', 'm3'] })).deleteAthlete).toBe(false);
    expect(planUndo(facts({ record: created, membershipIds: ['m9'], acsRows: [{ id: 'c9', state: 'da' }] })).deleteAthlete).toBe(false);
    expect(planUndo(facts({ record: created, membershipIds: ['m9'], athlete: { ...facts().athlete, profileId: 'sp1' } })).deleteAthlete).toBe(false);
  });
});

describe('undoAllowed', () => {
  it('only while the registration is still linked to the athlete the confirmation wrote', () => {
    expect(undoAllowed(record(), 'a1', 'a1')).toBe(true);
    expect(undoAllowed(record(), 'a2', 'a2')).toBe(false);
    expect(undoAllowed(record(), 'a1', null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/confirm/__tests__/undo-plan.test.ts`
Expected: FAIL with "Cannot find module '../undo-plan'".

- [ ] **Step 3: Write the implementation**

`src/club/confirm/undo-plan.ts`:

```ts
import type { AcsState } from '../acs';
import { changedFields, type FieldChange } from '../admin-result';
import { ATHLETE_FIELDS, isAthleteField, isDataIncomplete, pickAthleteValues, type AthleteStatus, type AthleteValues } from '../athlete-data';
import type { ConfirmationRecord, RegistrationStatus } from './plan';

/** "Anulează confirmarea" (spec 4.6): revert exactly what the confirmation wrote, never a later change. */
export type UndoFacts = {
  record: ConfirmationRecord;
  linkedAthleteId: string | null;
  athlete: AthleteValues & { id: string; status: AthleteStatus; profileId: string | null };
  membershipIds: string[];
  acsRows: { id: string; state: AcsState }[];
  otherRegistrations: number;
};

type AcsUndo = { op: 'delete'; id: string } | { op: 'set'; id: string; state: AcsState } | null;
type AthleteRevert = { athleteUpdate: (Partial<AthleteValues> & { status?: AthleteStatus; dataIncomplete: boolean }) | null; revertedFields: Record<string, FieldChange>; renameProfile: string | null };

export type UndoPlan = AthleteRevert & {
  registration: { status: RegistrationStatus };
  deleteMembershipId: string | null;
  restoreMainId: string | null;
  acs: AcsUndo;
  deleteAthlete: boolean;
};

export function undoAllowed(record: ConfirmationRecord, linkedAthleteId: string | null, athleteId: string | null): boolean {
  return athleteId !== null && linkedAthleteId === record.athleteId && athleteId === record.athleteId;
}

/** The written status is reverted only while it is still "În așteptare" (a payment in between is kept). */
function planAcsUndo(f: UndoFacts): AcsUndo {
  const written = f.record.acs;
  const row = written ? f.acsRows.find((r) => r.id === written.id) : undefined;
  if (!written || !row || row.state !== 'in_asteptare') return null;
  return written.previous === null ? { op: 'delete', id: row.id } : { op: 'set', id: row.id, state: written.previous };
}

/** "Nothing else" (gaps #32): no other registration, group or A.C.S. status; a public profile counts too (N9). */
function isUnused(f: UndoFacts, ownMembership: string | null, ownAcs: string | null): boolean {
  const otherMemberships = f.membershipIds.filter((id) => id !== ownMembership);
  const otherAcs = f.acsRows.filter((r) => r.id !== ownAcs);
  return f.otherRegistrations === 0 && otherMemberships.length === 0 && otherAcs.length === 0 && f.athlete.profileId === null;
}

function revertedStatus(before: AthleteStatus | null, now: AthleteStatus): AthleteStatus | null {
  return before !== null && before !== 'activ' && now === 'activ' ? before : null;
}

function valuesOf(changes: Record<string, FieldChange>, values: AthleteValues): Partial<AthleteValues> {
  const out: Partial<AthleteValues> = {};
  for (const key of Object.keys(changes)) if (isAthleteField(key)) out[key] = values[key];
  return out;
}

function planAthleteRevert(f: UndoFacts): AthleteRevert {
  const current = pickAthleteValues(f.athlete);
  const next = { ...current };
  for (const [key, written] of Object.entries(f.record.fieldsAfter)) {
    if (isAthleteField(key) && current[key] === written) next[key] = f.record.fieldsBefore[key] ?? null;
  }
  const revertedFields = changedFields(ATHLETE_FIELDS, current, next);
  const status = revertedStatus(f.record.athleteStatusBefore, f.athlete.status);
  const changed = Object.keys(revertedFields).length > 0 || status !== null;
  const athleteUpdate = changed ? { ...valuesOf(revertedFields, next), ...(status ? { status } : {}), dataIncomplete: isDataIncomplete(next) } : null;
  return { athleteUpdate, revertedFields, renameProfile: 'name' in revertedFields && f.athlete.profileId ? next.name : null };
}

export function planUndo(f: UndoFacts): UndoPlan {
  const acs = planAcsUndo(f);
  const own = f.record.membershipId;
  const deleteMembershipId = own && f.membershipIds.includes(own) ? own : null;
  const demoted = f.record.demotedMainId;
  const deleteAthlete = f.record.createdAthlete && isUnused(f, deleteMembershipId, acs?.op === 'delete' ? acs.id : null);
  const athlete = deleteAthlete ? { athleteUpdate: null, revertedFields: {}, renameProfile: null } : planAthleteRevert(f);
  return {
    registration: { status: f.record.previousStatus },
    deleteMembershipId,
    restoreMainId: demoted && f.membershipIds.includes(demoted) ? demoted : null,
    acs,
    ...athlete,
    deleteAthlete,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/club/confirm/__tests__/undo-plan.test.ts && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/confirm/undo-plan.ts src/club/confirm/__tests__/undo-plan.test.ts
git commit -m "feat(club): undo planner for a confirmation"
```

---

### Task 9: Merge planner

**Files:**
- Create: `src/club/athletes/merge-plan.ts`
- Test: `src/club/athletes/__tests__/merge-plan.test.ts`

**Interfaces:**
- Consumes: `ACS_RANK`, `AcsState` (Task 7); `ATHLETE_FIELDS`, `AthleteField`, `AthleteValues`, `AthleteStatus`, `isDataIncomplete`, `athleteChanges` (Task 5); `FieldChange`.
- Produces:
  - `type MergeSide = { id: string; name: string; values: AthleteValues; status: AthleteStatus; profile: { id: string; slug: string; previousSlugs: string[] } | null; memberships: { id: string; groupId: string; seasonId: string; isMain: boolean }[]; acs: { id: string; seasonId: string; state: AcsState }[] }`
  - `type MergePlan = { values: AthleteValues; fieldChanges: Record<string, FieldChange>; dataIncomplete: boolean; memberships: { move: { id: string; isMain: boolean }[]; remove: string[] }; acs: { move: string[]; raise: { id: string; state: AcsState }[]; remove: string[] }; profile: { moveId: string | null; deleteId: string | null; previousSlugs: string[] | null; finalId: string | null } }`
  - `mergeDiffering(kept: AthleteValues, removed: AthleteValues): AthleteField[]`, `planMerge(kept: MergeSide, removed: MergeSide, take: AthleteField[]): MergePlan`

- [ ] **Step 1: Write the failing test**

`src/club/athletes/__tests__/merge-plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AthleteValues } from '../../athlete-data';
import { mergeDiffering, planMerge, type MergeSide } from '../merge-plan';

const values = (over: Partial<AthleteValues> = {}): AthleteValues => ({
  name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722111222', email: null, ...over,
});
const side = (over: Partial<MergeSide> = {}): MergeSide => ({
  id: 'k', name: 'Maria Pop', values: values(), status: 'activ', profile: null, memberships: [], acs: [], ...over,
});

describe('fields (d39)', () => {
  it('keeps the kept values and takes the picked ones from the other record', () => {
    const plan = planMerge(side(), side({ id: 'r', values: values({ phone: '0733', email: 'ana@example.com' }) }), ['email']);
    expect(plan.values).toEqual(values({ email: 'ana@example.com' }));
    expect(plan.fieldChanges).toEqual({ email: { from: null, to: 'ana@example.com' } });
    expect(plan.dataIncomplete).toBe(false);
  });

  it('lists the differing fields for the merge screen', () => {
    expect(mergeDiffering(values(), values({ phone: '0733', email: 'x' }))).toEqual(['phone', 'email']);
  });
});

describe('groups (d39)', () => {
  it('keeps a group once, keeps the kept main group, keeps the other main group where the kept record has none', () => {
    const kept = side({ memberships: [{ id: 'k1', groupId: 'g1', seasonId: 's26', isMain: true }] });
    const removed = side({
      id: 'r',
      memberships: [
        { id: 'r1', groupId: 'g1', seasonId: 's26', isMain: true },
        { id: 'r2', groupId: 'g2', seasonId: 's26', isMain: false },
        { id: 'r3', groupId: 'g3', seasonId: 's25', isMain: true },
      ],
    });
    expect(planMerge(kept, removed, []).memberships).toEqual({
      move: [{ id: 'r2', isMain: false }, { id: 'r3', isMain: true }],
      remove: ['r1'],
    });
  });
});

describe('A.C.S. (d39)', () => {
  it('same season: the higher state stays (Da > În așteptare > Nu); other seasons move', () => {
    const kept = side({ acs: [{ id: 'k1', seasonId: 's26', state: 'in_asteptare' }, { id: 'k2', seasonId: 's24', state: 'da' }] });
    const removed = side({ id: 'r', acs: [{ id: 'r1', seasonId: 's26', state: 'da' }, { id: 'r2', seasonId: 's24', state: 'nu' }, { id: 'r3', seasonId: 's25', state: 'nu' }] });
    expect(planMerge(kept, removed, []).acs).toEqual({ move: ['r3'], raise: [{ id: 'k1', state: 'da' }], remove: ['r1', 'r2'] });
  });
});

describe('public profiles (d39, 3b s8)', () => {
  const kp = { id: 'sp-k', slug: 'maria-pop', previousSlugs: ['maria-p'] };
  const rp = { id: 'sp-r', slug: 'maria-pop-2', previousSlugs: ['m-pop', 'maria-p'] };

  it('two profiles: the kept one stays and remembers the other addresses', () => {
    expect(planMerge(side({ profile: kp }), side({ id: 'r', profile: rp }), []).profile).toEqual({
      moveId: null, deleteId: 'sp-r', previousSlugs: ['maria-p', 'maria-pop-2', 'm-pop'], finalId: 'sp-k',
    });
  });

  it('one profile: that one is kept', () => {
    expect(planMerge(side(), side({ id: 'r', profile: rp }), []).profile).toEqual({ moveId: 'sp-r', deleteId: null, previousSlugs: null, finalId: 'sp-r' });
    expect(planMerge(side({ profile: kp }), side({ id: 'r' }), []).profile).toEqual({ moveId: null, deleteId: null, previousSlugs: null, finalId: 'sp-k' });
    expect(planMerge(side(), side({ id: 'r' }), []).profile.finalId).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/athletes/__tests__/merge-plan.test.ts`
Expected: FAIL with "Cannot find module '../merge-plan'".

- [ ] **Step 3: Write the implementation**

`src/club/athletes/merge-plan.ts`:

```ts
import { ACS_RANK, type AcsState } from '../acs';
import type { FieldChange } from '../admin-result';
import { ATHLETE_FIELDS, athleteChanges, isDataIncomplete, type AthleteField, type AthleteStatus, type AthleteValues } from '../athlete-data';

/** "Unește cu alt sportiv" (spec 6.6, d39): everything moves to the kept record; no undo. */
export type MergeSide = {
  id: string;
  name: string;
  values: AthleteValues;
  status: AthleteStatus;
  profile: { id: string; slug: string; previousSlugs: string[] } | null;
  memberships: { id: string; groupId: string; seasonId: string; isMain: boolean }[];
  acs: { id: string; seasonId: string; state: AcsState }[];
};

export type MergePlan = {
  values: AthleteValues;
  fieldChanges: Record<string, FieldChange>;
  dataIncomplete: boolean;
  memberships: { move: { id: string; isMain: boolean }[]; remove: string[] };
  acs: { move: string[]; raise: { id: string; state: AcsState }[]; remove: string[] };
  profile: { moveId: string | null; deleteId: string | null; previousSlugs: string[] | null; finalId: string | null };
};

export function mergeDiffering(kept: AthleteValues, removed: AthleteValues): AthleteField[] {
  return ATHLETE_FIELDS.filter((f) => (kept[f] ?? '') !== (removed[f] ?? ''));
}

function planMemberships(kept: MergeSide, removed: MergeSide): MergePlan['memberships'] {
  const plan: MergePlan['memberships'] = { move: [], remove: [] };
  for (const m of removed.memberships) {
    const sameSeason = kept.memberships.filter((k) => k.seasonId === m.seasonId);
    if (sameSeason.some((k) => k.groupId === m.groupId)) plan.remove.push(m.id);
    else plan.move.push({ id: m.id, isMain: sameSeason.length === 0 ? m.isMain : false });
  }
  return plan;
}

function planAcs(kept: MergeSide, removed: MergeSide): MergePlan['acs'] {
  const plan: MergePlan['acs'] = { move: [], raise: [], remove: [] };
  for (const r of removed.acs) {
    const k = kept.acs.find((x) => x.seasonId === r.seasonId);
    if (!k) {
      plan.move.push(r.id);
      continue;
    }
    plan.remove.push(r.id);
    if (ACS_RANK[r.state] > ACS_RANK[k.state]) plan.raise.push({ id: k.id, state: r.state });
  }
  return plan;
}

function planProfile(kept: MergeSide, removed: MergeSide): MergePlan['profile'] {
  if (kept.profile && removed.profile) {
    const previousSlugs = [...new Set([...kept.profile.previousSlugs, removed.profile.slug, ...removed.profile.previousSlugs])];
    return { moveId: null, deleteId: removed.profile.id, previousSlugs, finalId: kept.profile.id };
  }
  if (removed.profile) return { moveId: removed.profile.id, deleteId: null, previousSlugs: null, finalId: removed.profile.id };
  return { moveId: null, deleteId: null, previousSlugs: null, finalId: kept.profile?.id ?? null };
}

/** The kept record's status stays (N6, option A). */
export function planMerge(kept: MergeSide, removed: MergeSide, take: AthleteField[]): MergePlan {
  const values = { ...kept.values };
  for (const field of take) values[field] = removed.values[field];
  return {
    values,
    fieldChanges: athleteChanges(kept.values, values),
    dataIncomplete: isDataIncomplete(values),
    memberships: planMemberships(kept, removed),
    acs: planAcs(kept, removed),
    profile: planProfile(kept, removed),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/club/athletes/__tests__/merge-plan.test.ts && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/merge-plan.ts src/club/athletes/__tests__/merge-plan.test.ts
git commit -m "feat(club): merge planner for two athlete records"
```

---

### Task 10: Deploy planners

**Files:**
- Create: `src/club/deploy/name-migration.ts`, `src/club/deploy/past-registrations.ts`, `src/club/deploy/duplicate-flags.ts`, `src/club/deploy/deploy-status.ts`
- Modify: `src/club/migrate/plan.ts` (`planAthletes`, imports), `src/club/migrate/names.ts` (remove `splitPersonName`), `src/club/__tests__/plan.test.ts:90-101`, `src/club/__tests__/names.test.ts` (remove the `splitPersonName` block and import), `scripts/migrate-club-foundation.js:113-127` (`migrateAthletes`)
- Test: `src/club/deploy/__tests__/deploy.test.ts`

**Interfaces:**
- Consumes: Task 2 (`isoDate`, `parseBirthDate`), Task 3 (`collapseSpaces`, `sameName`), Task 4 (`duplicateLevel`, `PersonFacts`, `StoredMatchLevel`), Task 5 (`AthleteValues`, `AthleteStatus`).
- Produces:
  - `planAthletes(input)` now returns `{ create: { name: string; publicProfileId: string; dataIncomplete: true }[] }`
  - `type LegacyName = { id: string; name: string | null; firstName: string | null; lastName: string | null; profileName: string | null }`; `planNameMigration(rows: LegacyName[]): { updates: { id: string; name: string }[]; empty: string[]; profileMismatches: { id: string; name: string; profileName: string }[] }`
  - `type PastRegistration = { id: string; number: string | null; childName: string; childBirthDate: string; parentName: string; phone: string; email: string; status: string; seasonLabel: string | null; submittedAt: string | null }`; `type PastAthlete = { values: AthleteValues; registrations: { documentId: string; season: string; number: string | null }[] }`; `planPastRegistrationAthletes(rows: PastRegistration[], currentLabel: string, covered: ReadonlySet<string>): { create: PastAthlete[]; skipped: { covered: number; respins: number; noSeason: number; currentOrLater: number } }`
  - `type FlagCandidate = PersonFacts & { id: string }`; `planDuplicateFlags(athletes: FlagCandidate[], existing: { firstId: string; secondId: string }[]): { firstId: string; secondId: string; level: StoredMatchLevel }[]`
  - `planDeployStatus(athletes: { id: string; status: AthleteStatus; profileId: string | null }[], currentRegistrations: { athleteId: string | null; matchAthleteId: string | null; matchLevel: StoredMatchLevel | null }[], publicProfileIds: ReadonlySet<string>): { id: string; from: AthleteStatus; to: AthleteStatus }[]`

- [ ] **Step 1: Write the failing tests**

`src/club/deploy/__tests__/deploy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planAthletes } from '../../migrate/plan';
import { planDeployStatus } from '../deploy-status';
import { planDuplicateFlags } from '../duplicate-flags';
import { planNameMigration } from '../name-migration';
import { planPastRegistrationAthletes, type PastRegistration } from '../past-registrations';

describe('step 7: one name (spec 1.1)', () => {
  it('joins first and last, collapses spaces, skips named rows, reports empty rows and profile mismatches (N7)', () => {
    const plan = planNameMigration([
      { id: 'a1', name: null, firstName: 'Ana  Maria', lastName: 'Pop', profileName: 'Ana Maria Pop' },
      { id: 'a2', name: 'Ion Ilie', firstName: 'Ion', lastName: 'Ilie', profileName: null },
      { id: 'a3', name: null, firstName: '', lastName: null, profileName: null },
      { id: 'a4', name: null, firstName: 'Luca', lastName: 'Stoica', profileName: 'Luca Andrei Stoica' },
    ]);
    expect(plan.updates).toEqual([{ id: 'a1', name: 'Ana Maria Pop' }, { id: 'a4', name: 'Luca Stoica' }]);
    expect(plan.empty).toEqual(['a3']);
    expect(plan.profileMismatches).toEqual([{ id: 'a4', name: 'Luca Stoica', profileName: 'Luca Andrei Stoica' }]);
  });
});

describe('step 8: athletes for profiles without one (3b Q33)', () => {
  it('writes the full name', () => {
    expect(planAthletes({ sportspeople: [{ documentId: 'p1', name: ' Maria  Dumitrescu' }, { documentId: 'p2', name: 'Ana' }], linkedProfileIds: ['p2'] }).create).toEqual([
      { name: 'Maria Dumitrescu', publicProfileId: 'p1', dataIncomplete: true },
    ]);
  });
});

const past = (over: Partial<PastRegistration> & { id: string }): PastRegistration => ({
  number: null, childName: 'Luca Stoica', childBirthDate: '01.02.2015', parentName: 'Ion Stoica', phone: '0722000001', email: 'ion@example.com',
  status: 'Nou', seasonLabel: '2025-2026', submittedAt: '2025-10-01T10:00:00.000Z', ...over,
});

describe('step 9: athletes from past registrations (d17, Open #1)', () => {
  it('one athlete per child across seasons; newest contact and name as written win', () => {
    const plan = planPastRegistrationAthletes([
      past({ id: 'r1', seasonLabel: '2024-2025', submittedAt: '2024-10-01T10:00:00.000Z' }),
      past({ id: 'r2', childName: 'Stoica Luca', phone: '0722000009', parentName: 'Ana Stoica', submittedAt: '2025-10-05T10:00:00.000Z' }),
    ], '2026-2027', new Set());
    expect(plan.create).toEqual([{
      values: { name: 'Stoica Luca', birthDate: '2015-02-01', contactName: 'Ana Stoica', phone: '0722000009', email: 'ion@example.com' },
      registrations: [{ documentId: 'r1', season: '2024-2025', number: null }, { documentId: 'r2', season: '2025-2026', number: null }],
    }]);
  });

  it('skips Respins, the current season, registrations with no season and those already used', () => {
    const plan = planPastRegistrationAthletes([
      past({ id: 'r1', status: 'Respins' }),
      past({ id: 'r2', seasonLabel: '2026-2027' }),
      past({ id: 'r3', seasonLabel: null }),
      past({ id: 'r4' }),
    ], '2026-2027', new Set(['r4']));
    expect(plan).toEqual({ create: [], skipped: { covered: 1, respins: 1, noSeason: 1, currentOrLater: 1 } });
  });

  it('an unreadable birth date forms its own athlete without a date', () => {
    const plan = planPastRegistrationAthletes([past({ id: 'r1', childBirthDate: 'ieri' }), past({ id: 'r2' })], '2026-2027', new Set());
    expect(plan.create.map((a) => [a.values.birthDate, a.registrations.length])).toEqual([[null, 1], ['2015-02-01', 1]]);
  });
});

describe('step 11: possible duplicates (spec 2.3)', () => {
  it('flags each pair once and skips pairs already flagged, in either order', () => {
    const athletes = [
      { id: 'a', name: 'Maria Pop', birthDate: null, phone: null, email: null },
      { id: 'b', name: 'Pop Maria', birthDate: '2016-03-14', phone: null, email: null },
      { id: 'c', name: 'Maria Pop', birthDate: '2016-03-14', phone: null, email: null },
      { id: 'd', name: 'Ion Ilie', birthDate: '2016-03-14', phone: null, email: null },
    ];
    expect(planDuplicateFlags(athletes, [{ firstId: 'c', secondId: 'a' }])).toEqual([
      { firstId: 'a', secondId: 'b', level: 'probabil' },
      { firstId: 'b', secondId: 'c', level: 'sigur' },
    ]);
  });
});

describe('step 12: status at deploy (3b s6, gaps #18)', () => {
  it('Activ if registered this season (linked or Sigur) or with the page on; all others Inactiv; unchanged rows left out', () => {
    const changes = planDeployStatus(
      [
        { id: 'linked', status: 'inactiv', profileId: null },
        { id: 'sigur', status: 'activ', profileId: null },
        { id: 'probabil', status: 'activ', profileId: null },
        { id: 'public', status: 'activ', profileId: 'sp1' },
        { id: 'hidden', status: 'activ', profileId: 'sp2' },
      ],
      [
        { athleteId: 'linked', matchAthleteId: null, matchLevel: null },
        { athleteId: null, matchAthleteId: 'sigur', matchLevel: 'sigur' },
        { athleteId: null, matchAthleteId: 'probabil', matchLevel: 'probabil' },
      ],
      new Set(['sp1']),
    );
    expect(changes).toEqual([
      { id: 'linked', from: 'inactiv', to: 'activ' },
      { id: 'probabil', from: 'activ', to: 'inactiv' },
      { id: 'hidden', from: 'activ', to: 'inactiv' },
    ]);
  });
});
```

Replace the `planAthletes` test in `src/club/__tests__/plan.test.ts` (lines 90-101) with:

```ts
describe('planAthletes', () => {
  it('creates one athlete per public profile not linked yet, with the full name', () => {
    const plan = planAthletes({
      sportspeople: [
        { documentId: 'p1', name: 'Maria Dumitrescu' },
        { documentId: 'p2', name: 'Ana Bălan' },
      ],
      linkedProfileIds: ['p2'],
    });
    expect(plan.create).toEqual([{ name: 'Maria Dumitrescu', publicProfileId: 'p1', dataIncomplete: true }]);
  });
});
```

In `src/club/__tests__/names.test.ts` delete the `describe('splitPersonName', ...)` block and remove `splitPersonName` from the import.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/deploy src/club/__tests__/plan.test.ts`
Expected: FAIL ("Cannot find module '../deploy-status'"; `planAthletes` still returns `firstName`).

- [ ] **Step 3: Write the implementation**

`src/club/deploy/name-migration.ts`:

```ts
import { collapseSpaces } from '../person-match';

/** Deploy step 7 (spec 1.1): first + last become the one name. Profiles are not touched (N7, option A). */
export type LegacyName = { id: string; name: string | null; firstName: string | null; lastName: string | null; profileName: string | null };
export type NamePlan = { updates: { id: string; name: string }[]; empty: string[]; profileMismatches: { id: string; name: string; profileName: string }[] };

export function planNameMigration(rows: LegacyName[]): NamePlan {
  const plan: NamePlan = { updates: [], empty: [], profileMismatches: [] };
  for (const row of rows) {
    if (collapseSpaces(row.name)) continue;
    const name = collapseSpaces(`${row.firstName ?? ''} ${row.lastName ?? ''}`);
    if (!name) {
      plan.empty.push(row.id);
      continue;
    }
    plan.updates.push({ id: row.id, name });
    const profileName = collapseSpaces(row.profileName);
    if (profileName && profileName !== name) plan.profileMismatches.push({ id: row.id, name, profileName });
  }
  return plan;
}
```

`src/club/deploy/past-registrations.ts`:

```ts
import type { AthleteValues } from '../athlete-data';
import { isoDate, parseBirthDate } from '../birth-date';
import { collapseSpaces, sameName } from '../person-match';

/**
 * Deploy step 9 (spec 2.3, d17, Open #1): one athlete per child from the registrations of the seasons before the
 * current one, archived included, "Respins" skipped. Same name (Sigur rule) + same birth date across seasons;
 * an unreadable date forms its own athlete. The registrations stay unlinked. `covered`: registrations already used.
 */
export type PastRegistration = {
  id: string; number: string | null; childName: string; childBirthDate: string; parentName: string; phone: string; email: string;
  status: string; seasonLabel: string | null; submittedAt: string | null;
};
export type PastAthlete = { values: AthleteValues; registrations: { documentId: string; season: string; number: string | null }[] };
type Skipped = { covered: number; respins: number; noSeason: number; currentOrLater: number };
export type PastPlan = { create: PastAthlete[]; skipped: Skipped };
type Eligible = PastRegistration & { season: string; birth: string | null };

function skipReason(r: PastRegistration, currentLabel: string, covered: ReadonlySet<string>): keyof Skipped | null {
  if (covered.has(r.id)) return 'covered';
  if (r.status === 'Respins') return 'respins';
  if (!r.seasonLabel) return 'noSeason';
  return r.seasonLabel >= currentLabel ? 'currentOrLater' : null;
}

function eligible(rows: PastRegistration[], currentLabel: string, covered: ReadonlySet<string>): { rows: Eligible[]; skipped: Skipped } {
  const skipped: Skipped = { covered: 0, respins: 0, noSeason: 0, currentOrLater: 0 };
  const out: Eligible[] = [];
  for (const r of rows) {
    const reason = skipReason(r, currentLabel, covered);
    const birth = parseBirthDate(r.childBirthDate);
    if (reason) skipped[reason] += 1;
    else out.push({ ...r, season: r.seasonLabel ?? '', birth: birth ? isoDate(birth) : null });
  }
  return { rows: out, skipped };
}

function groupChildren(rows: Eligible[]): Eligible[][] {
  const groups: Eligible[][] = [];
  for (const r of rows) {
    const home = r.birth ? groups.find((g) => g[0].birth === r.birth && g.some((m) => sameName(m.childName, r.childName))) : undefined;
    if (home) home.push(r);
    else groups.push([r]);
  }
  return groups;
}

const newestFirst = (a: Eligible, b: Eligible) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '') || b.season.localeCompare(a.season);
const orNull = (v: string) => collapseSpaces(v) || null;

function toAthlete(group: Eligible[]): PastAthlete {
  const [newest] = [...group].sort(newestFirst);
  return {
    values: { name: orNull(newest.childName), birthDate: newest.birth, contactName: orNull(newest.parentName), phone: orNull(newest.phone), email: orNull(newest.email) },
    registrations: group.map((r) => ({ documentId: r.id, season: r.season, number: r.number })),
  };
}

export function planPastRegistrationAthletes(rows: PastRegistration[], currentLabel: string, covered: ReadonlySet<string>): PastPlan {
  const { rows: usable, skipped } = eligible(rows, currentLabel, covered);
  const create = groupChildren(usable).map(toAthlete).sort((a, b) => (a.values.name ?? '').localeCompare(b.values.name ?? '', 'ro') || (a.values.birthDate ?? '').localeCompare(b.values.birthDate ?? ''));
  return { create, skipped };
}
```

`src/club/deploy/duplicate-flags.ts`:

```ts
import { duplicateLevel, type PersonFacts, type StoredMatchLevel } from '../matching';

/** Deploy step 11 (spec 2.3, d12): pairs flagged once, for the "Posibil același copil cu <nume>" line. */
export type FlagCandidate = PersonFacts & { id: string };
export type FlagPair = { firstId: string; secondId: string; level: StoredMatchLevel };

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function flagPair(a: FlagCandidate, b: FlagCandidate, known: ReadonlySet<string>): FlagPair | null {
  if (known.has(pairKey(a.id, b.id))) return null;
  const level = duplicateLevel(a, b);
  return level ? { firstId: a.id, secondId: b.id, level } : null;
}

export function planDuplicateFlags(athletes: FlagCandidate[], existing: { firstId: string; secondId: string }[]): FlagPair[] {
  const known = new Set(existing.map((p) => pairKey(p.firstId, p.secondId)));
  const create: FlagPair[] = [];
  for (let i = 0; i < athletes.length; i += 1) {
    for (let j = i + 1; j < athletes.length; j += 1) {
      const pair = flagPair(athletes[i], athletes[j], known);
      if (pair) create.push(pair);
    }
  }
  return create;
}
```

`src/club/deploy/deploy-status.ts`:

```ts
import type { AthleteStatus } from '../athlete-data';
import type { StoredMatchLevel } from '../matching';

/**
 * Deploy step 12 (spec 1.5, gaps #18, P9): "Activ" if a current-season registration is linked to the athlete or
 * matched "Sigur" to it, or its public page is on; every other athlete "Inactiv". Rows already right are left out.
 */
export type StatusAthlete = { id: string; status: AthleteStatus; profileId: string | null };
export type CurrentRegistration = { athleteId: string | null; matchAthleteId: string | null; matchLevel: StoredMatchLevel | null };

function registeredThisSeason(registrations: CurrentRegistration[]): Set<string> {
  const ids = new Set<string>();
  for (const r of registrations) {
    if (r.athleteId) ids.add(r.athleteId);
    else if (r.matchAthleteId && r.matchLevel === 'sigur') ids.add(r.matchAthleteId);
  }
  return ids;
}

export function planDeployStatus(
  athletes: StatusAthlete[],
  currentRegistrations: CurrentRegistration[],
  publicProfileIds: ReadonlySet<string>,
): { id: string; from: AthleteStatus; to: AthleteStatus }[] {
  const registered = registeredThisSeason(currentRegistrations);
  return athletes.flatMap((a) => {
    const active = registered.has(a.id) || (a.profileId !== null && publicProfileIds.has(a.profileId));
    const to: AthleteStatus = active ? 'activ' : 'inactiv';
    return a.status === to ? [] : [{ id: a.id, from: a.status, to }];
  });
}
```

In `src/club/migrate/plan.ts`, change the import on line 3 and `planAthletes`:

```ts
import { nameKey, parsePrice } from './names';
import { collapseSpaces } from '../person-match';
```

```ts
export function planAthletes(input: { sportspeople: { documentId: string; name: string }[]; linkedProfileIds: string[] }) {
  const linked = new Set(input.linkedProfileIds);
  const create = input.sportspeople
    .filter((p) => !linked.has(p.documentId))
    .map((p) => ({ name: collapseSpaces(p.name), publicProfileId: p.documentId, dataIncomplete: true as const }));
  return { create };
}
```

In `src/club/migrate/names.ts` delete the whole `splitPersonName` function (no other caller).

In `scripts/migrate-club-foundation.js`, the loop of `migrateAthletes` becomes:

```js
  for (const a of athletePlan.create) {
    log('athlete', a.name);
    await created('api::athlete.athlete', 'athlete', {
      name: a.name,
      dataIncomplete: true,
      publicProfile: a.publicProfileId,
    });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit`
Expected: PASS, zero type errors; `grep -rn splitPersonName src scripts` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/club/deploy src/club/migrate src/club/__tests__/plan.test.ts src/club/__tests__/names.test.ts scripts/migrate-club-foundation.js
git commit -m "feat(club): deploy planners for names, past registrations, duplicates and status"
```

---
### Task 11: Club store, API types and the in-memory fake

**Files:**
- Modify: `src/club/admin-result.ts` (status 500)
- Create: `src/club/athletes/store.ts`, `src/club/athletes/api-types.ts`, `src/club/athletes/strapi-store.ts`, `src/club/athletes/http.ts`, `src/club/athletes/__tests__/fake-store.ts`
- Test: `src/club/athletes/__tests__/strapi-store.test.ts`, `src/club/athletes/__tests__/fake-store.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 9 types (`DateParts`, `AthleteValues`, `AthleteStatus`, `StoredMatchLevel`, `ConfirmationRecord`, `RegistrationStatus`, `ComparisonRow`, `AcsState`, `HistoryInput`), `recordHistory`, `adminActor`, `AdminCtx`, `todayInBucharest`.
- Produces:
  - `AdminResult` refusals may carry `status: 500`.
  - Row types `AthleteRow`, `RegistrationRow`, `SeasonRow`, `SectionRow`, `GroupRow`, `MembershipRow`, `AcsRow`, `DuplicateRow`, `ProfileRow`, `HistoryRow`; write types `RegistrationPatch`, `AthleteWrite`; `interface ClubStore` (methods below); `type ServiceContext = { store: ClubStore; actor: string; today: DateParts; log: (message: string) => void }`.
  - `strapiClubStore(strapi: Core.Strapi): ClubStore`; mappers `toAthleteRow`, `toRegistrationRow`, `toProfileRows`.
  - `clubStore(strapi)`, `serviceContext(strapi, ctx): Promise<ServiceContext>`, `queryText(v: unknown): string`.
  - Test helpers: `fakeClubStore(seed?: Partial<FakeState>): { store: ClubStore; state: FakeState; failOn(method: keyof ClubStore): void }`, `athleteRow(over)`, `registrationRow(over)`, `SEASONS`, `SECTIONS`, `GROUPS`.
  - Every JSON type of the "Interfaces for other plans" section, in `api-types.ts`.

- [ ] **Step 1: Write the failing tests**

`src/club/athletes/__tests__/strapi-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toAthleteRow, toProfileRows, toRegistrationRow } from '../strapi-store';

describe('Strapi rows -> store rows', () => {
  it('reads an athlete with its profile link', () => {
    expect(toAthleteRow({
      documentId: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', contactName: null, phone: '07', email: null,
      status: 'inactiv', dataIncomplete: true, publicProfile: { documentId: 'sp1' }, updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    })).toEqual({
      id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', contactName: null, phone: '07', email: null,
      status: 'inactiv', dataIncomplete: true, profileId: 'sp1', updatedAt: '2026-10-01T10:00:00.000Z',
    });
  });

  it('reads a registration with its links, match and confirmation', () => {
    const row = toRegistrationRow({
      documentId: 'r1', registrationNumber: '2026-0142', childName: 'Maria', childBirthDate: '14.03.2016', parentName: 'Ana', phone: '07', email: 'e',
      status: 'Contactat', archived: null, season: '2026-2027', seasonRef: { documentId: 's26' }, section: { documentId: 'afi' },
      athlete: null, matchAthlete: { documentId: 'a1' }, matchLevel: 'sigur', childBirthDateParsed: '2016-03-14',
      membershipAnswer: 'da', lastSeason: 'Nu a participat', subscriptionChoice: { priceItemName: 'X' }, confirmation: null, submittedAt: '2026-10-03T11:22:00.000Z',
    });
    expect(row).toMatchObject({ id: 'r1', number: '2026-0142', status: 'Contactat', archived: false, seasonId: 's26', sectionId: 'afi', athleteId: null, matchAthleteId: 'a1', matchLevel: 'sigur', membershipAnswer: 'da' });
    expect(toRegistrationRow({ documentId: 'r2', status: 'x', matchLevel: 'alt', membershipAnswer: 'poate', confirmation: { other: 1 } })).toMatchObject({
      status: 'Nou', matchLevel: null, membershipAnswer: null, confirmation: null, childName: '',
    });
  });

  it('merges the draft and published rows of a profile; the published row decides "Public"', () => {
    expect(toProfileRows([
      { documentId: 'sp1', name: 'Maria', slug: 'maria', showPublicPage: false, publishedAt: null, previousSlugs: null },
      { documentId: 'sp1', name: 'Maria', slug: 'maria', showPublicPage: true, publishedAt: '2026-01-01', previousSlugs: ['m'] },
      { documentId: 'sp2', name: 'Ion', slug: 'ion', showPublicPage: true, publishedAt: null, previousSlugs: 'x' },
    ])).toEqual([
      { id: 'sp1', name: 'Maria', slug: 'maria', previousSlugs: ['m'], showPublicPage: true, published: true },
      { id: 'sp2', name: 'Ion', slug: 'ion', previousSlugs: [], showPublicPage: false, published: false },
    ]);
  });
});
```

`src/club/athletes/__tests__/fake-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { athleteRow, fakeClubStore } from './fake-store';

describe('the in-memory store used by the service tests', () => {
  it('rolls a failed transaction back completely', async () => {
    const { store, state, failOn } = fakeClubStore({ athletes: [athleteRow({ id: 'a1' })] });
    failOn('createMembership');
    await expect(store.transaction(async () => {
      await store.createAthlete({ name: 'Nou' });
      await store.createMembership({ athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null });
    })).rejects.toThrow('fake failure in createMembership');
    expect(state.athletes.map((a) => a.id)).toEqual(['a1']);
  });

  it('fails only once and hands out copies', async () => {
    const { store, failOn } = fakeClubStore({ athletes: [athleteRow({ id: 'a1', name: 'Ana' })] });
    failOn('athlete');
    await expect(store.athlete('a1')).rejects.toThrow();
    const copy = await store.athlete('a1');
    if (copy) copy.name = 'changed';
    expect((await store.athlete('a1'))?.name).toBe('Ana');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/athletes/__tests__/strapi-store.test.ts src/club/athletes/__tests__/fake-store.test.ts`
Expected: FAIL with "Cannot find module '../strapi-store'" and "'./fake-store'".

- [ ] **Step 3: Write the implementation**

In `src/club/admin-result.ts` widen the refusal status:

```ts
export type AdminResult<T> = { ok: true; data: T } | { ok: false; status: 400 | 404 | 409 | 500; error: string };

export const refuse = (status: 400 | 404 | 409 | 500, error: string): AdminResult<never> => ({ ok: false, status, error });
```

`src/club/athletes/store.ts`:

```ts
import type { AcsState } from '../acs';
import type { AthleteStatus, AthleteValues } from '../athlete-data';
import type { DateParts } from '../birth-date';
import type { ConfirmationRecord, RegistrationStatus } from '../confirm/plan';
import type { HistoryInput } from '../history';
import type { StoredMatchLevel } from '../matching';

/** Club data as the 3A+3B services see it. Ids are Strapi documentIds. `strapiClubStore` is the real one. */
export type AthleteRow = AthleteValues & { id: string; status: AthleteStatus; dataIncomplete: boolean; profileId: string | null; updatedAt: string };
export type RegistrationRow = {
  id: string; number: string | null; childName: string; childBirthDate: string; parentName: string; phone: string; email: string;
  status: RegistrationStatus; archived: boolean; season: string | null; seasonId: string | null; sectionId: string | null;
  athleteId: string | null; matchAthleteId: string | null; matchLevel: StoredMatchLevel | null; childBirthDateParsed: string | null;
  membershipAnswer: 'da' | 'nu' | null; lastSeason: string | null; subscriptionChoice: unknown; confirmation: ConfirmationRecord | null; submittedAt: string | null;
};
export type SeasonRow = { id: string; label: string; startMonth: string; endMonth: string; isCurrent: boolean };
export type SectionRow = { id: string; name: string; kind: 'school' | 'club'; publicPage: boolean; order: number | null };
export type GroupRow = { id: string; name: string; sectionId: string | null; order: number | null; active: boolean };
export type MembershipRow = { id: string; athleteId: string; groupId: string; seasonId: string; isMain: boolean; from: string | null };
export type AcsRow = { id: string; athleteId: string; seasonId: string; state: AcsState };
export type DuplicateRow = { id: string; firstId: string; secondId: string };
/** One public profile; `showPublicPage` and `published` come from its published row. */
export type ProfileRow = { id: string; name: string; slug: string; previousSlugs: string[]; showPublicPage: boolean; published: boolean };
export type HistoryRow = { seq: number; subjectType: string; subjectId: string; action: string; changes: Record<string, unknown>; actor: string; at: string };

export type RegistrationPatch = Partial<{
  athleteId: string | null; matchAthleteId: string | null; matchLevel: StoredMatchLevel | null; childBirthDateParsed: string | null;
  status: RegistrationStatus; sectionId: string; confirmation: ConfirmationRecord | null;
}>;
export type AthleteWrite = Partial<AthleteValues & { status: AthleteStatus; dataIncomplete: boolean; profileId: string | null }>;

export interface ClubStore {
  /** All writes inside `work` are saved together or not at all. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
  /** Inside a transaction: holds the registration row until the transaction ends (concurrent confirm, spec 4.7). */
  lockRegistration(id: string): Promise<void>;
  registration(id: string): Promise<RegistrationRow | null>;
  registrations(where?: { athleteId?: string }): Promise<RegistrationRow[]>;
  athlete(id: string): Promise<AthleteRow | null>;
  athletes(): Promise<AthleteRow[]>;
  seasons(): Promise<SeasonRow[]>;
  sections(): Promise<SectionRow[]>;
  groups(): Promise<GroupRow[]>;
  memberships(athleteId?: string): Promise<MembershipRow[]>;
  acsRows(athleteId?: string): Promise<AcsRow[]>;
  duplicates(): Promise<DuplicateRow[]>;
  profiles(): Promise<ProfileRow[]>;
  history(subjectType: string, subjectId: string): Promise<HistoryRow[]>;
  historyByAction(action: string): Promise<HistoryRow[]>;
  adminNames(emails: string[]): Promise<Record<string, string>>;
  updateRegistration(id: string, patch: RegistrationPatch): Promise<void>;
  createAthlete(data: AthleteWrite): Promise<string>;
  updateAthlete(id: string, data: AthleteWrite): Promise<void>;
  deleteAthlete(id: string): Promise<void>;
  createMembership(data: Omit<MembershipRow, 'id'>): Promise<string>;
  updateMembership(id: string, data: Partial<Pick<MembershipRow, 'athleteId' | 'isMain'>>): Promise<void>;
  deleteMembership(id: string): Promise<void>;
  createAcs(data: Omit<AcsRow, 'id'>): Promise<string>;
  updateAcs(id: string, data: Partial<Pick<AcsRow, 'athleteId' | 'state'>>): Promise<void>;
  deleteAcs(id: string): Promise<void>;
  createDuplicate(firstId: string, secondId: string): Promise<void>;
  deleteDuplicate(id: string): Promise<void>;
  createProfile(name: string, slug: string): Promise<string>;
  /** Draft and published rows together, other draft edits untouched (gaps #38). */
  renameProfile(id: string, name: string): Promise<void>;
  setProfileVisibility(id: string, on: boolean): Promise<void>;
  setPreviousSlugs(id: string, slugs: string[]): Promise<void>;
  /** The profile with its competition participations (spec 6.6). */
  deleteProfile(id: string): Promise<void>;
  moveHistory(fromAthleteId: string, toAthleteId: string): Promise<void>;
  record(entry: HistoryInput): Promise<void>;
}

/** What every 3A+3B service gets from its controller. */
export type ServiceContext = { store: ClubStore; actor: string; today: DateParts; log: (message: string) => void };
```

`src/club/athletes/api-types.ts`:

```ts
import type { AcsState } from '../acs';
import type { AthleteField, AthleteStatus } from '../athlete-data';
import type { ComparisonRow } from '../confirm/compare';
import type { RegistrationStatus } from '../confirm/plan';

/** JSON the 3A+3B admin routes answer, inside `{ data }`. The admin UI plans import these types. */

/** A two-line athlete row or card: name, then birth date (ZZ.LL.AAAA), last group, parent. */
export type AthleteCard = {
  documentId: string;
  name: string;
  birthDate: string | null;
  lastGroup: { name: string; season: string } | null;
  lastRegistrationSeason: string | null;
  contactName: string | null;
  status: AthleteStatus;
};

/** GET /api/club/registrations/:documentId/match: the panel's match card and the window's start. */
export type RegistrationMatchView = {
  confirmed: boolean;
  athleteId: string | null;
  canConfirm: boolean;
  canUndo: boolean;
  birthDateReadable: boolean;
  notAttendedLastSeason: boolean;
  existing: AthleteCard | null;
  preselect: 'existing' | null;
  comparison: ComparisonRow[];
  candidates: AthleteCard[];
};

export type GroupOption = { documentId: string; name: string };
export type GroupSection = { sectionId: string; sectionName: string; groups: GroupOption[] };

/** GET /api/club/registrations/:documentId/confirm-context?athlete=: everything the confirm window shows for one choice. */
export type ConfirmContext = {
  registrationNumber: string | null;
  newAthlete: { name: string; birthDate: string | null };
  season: { label: string | null; running: boolean; endedText: string | null };
  groups: GroupSection[];
  mainGroupNow: { name: string; sectionName: string } | null;
  acs: { seasonLabel: string | null; current: AcsState | null; next: AcsState | null; wish: 'da' | 'nu' | null };
  subscriptionIntent: string | null;
  comparison: ComparisonRow[];
  defaultUpdateFields: AthleteField[];
  blocked: 'confirmed' | 'not-confirmable' | 'birth-date' | null;
};

export type ConfirmResponse = { athleteId: string; athleteName: string; registrationId: string };
export type UndoResponse = { status: RegistrationStatus; athleteDeleted: boolean };
export type MoveSchoolResponse = { moved: number; skipped: number };
export type HistoryLine = { at: string; actor: string; text: string };

/** One row of GET /api/club/athletes. `missing` may be empty while `dataIncomplete` is true (deploy-marked records). */
export type AthleteListRow = {
  documentId: string;
  name: string;
  age: number | null;
  birthDate: string | null;
  status: AthleteStatus;
  dataIncomplete: boolean;
  missing: string[];
  mainGroup: { documentId: string; name: string } | null;
  contactName: string | null;
  phone: string | null;
  acs: AcsState;
  publicProfile: 'public' | 'ascuns';
  possibleDuplicate: boolean;
};

export type AthleteListPage = {
  data: AthleteListRow[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  unfiltered: number;
  incomplete: number;
  season: { documentId: string; label: string } | null;
  seasons: { documentId: string; label: string; isCurrent: boolean }[];
  options: { sections: { value: string; label: string }[]; groups: { value: string; label: string; sectionName: string }[] };
};

export type AthleteRecord = {
  documentId: string;
  fields: Record<AthleteField, string | null>;
  missing: AthleteField[];
  status: AthleteStatus;
  dataIncomplete: boolean;
  header: { birthDate: string | null; mainGroup: string | null };
  season: { documentId: string; label: string } | null;
  acs: { seasonLabel: string | null; state: AcsState };
  registrations: { documentId: string; number: string | null; season: string | null; status: RegistrationStatus }[];
  documents: { registrationDocumentId: string; kind: 'acord' | 'adeziune'; label: string }[];
  profile: { documentId: string; slug: string; showPublicPage: boolean } | null;
  duplicates: { pairId: string; documentId: string; name: string }[];
  historyCount: number;
};

export type AthleteEditResponse = { record: AthleteRecord; changed: AthleteField[] };

export type MergeSideView = { documentId: string; name: string; fields: Record<AthleteField, string>; status: AthleteStatus; profileSlug: string | null; registrations: number };
export type MergePreview = { kept: MergeSideView; removed: MergeSideView; differing: AthleteField[] };
```

`src/club/athletes/strapi-store.ts`:

```ts
import type { Core } from '@strapi/strapi';
import type { Knex } from 'knex';
import type { AthleteStatus } from '../athlete-data';
import type { ConfirmationRecord, RegistrationStatus } from '../confirm/plan';
import { recordHistory } from '../history';
import type { AcsState } from '../acs';
import type {
  AcsRow, AthleteRow, AthleteWrite, ClubStore, DuplicateRow, GroupRow, HistoryRow, MembershipRow, ProfileRow, RegistrationPatch, RegistrationRow, SeasonRow, SectionRow,
} from './store';

const ATHLETE = 'api::athlete.athlete' as const;
const REGISTRATION = 'api::registration-submission.registration-submission' as const;
const SEASON = 'api::season.season' as const;
const SECTION = 'api::section.section' as const;
const GROUP = 'api::group.group' as const;
const MEMBERSHIP = 'api::group-membership.group-membership' as const;
const ACS = 'api::acs-membership.acs-membership' as const;
const DUPLICATE = 'api::athlete-duplicate.athlete-duplicate' as const;
const PROFILE = 'api::sportsperson.sportsperson' as const;
const COMPETITION = 'api::competition.competition' as const;
const HISTORY = 'api::history-entry.history-entry' as const;
const MAX = 100000;

type Raw = Record<string, unknown>;
const raws = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : str(v));
const linkId = (v: unknown): string | null => (v && typeof v === 'object' ? str((v as Raw).documentId) : null);
const STATUSES: readonly RegistrationStatus[] = ['Nou', 'Contactat', 'Confirmat', 'Respins'];
const ATHLETE_STATUSES: readonly AthleteStatus[] = ['nou', 'activ', 'inactiv'];
const ACS_STATES: readonly AcsState[] = ['da', 'nu', 'in_asteptare'];
const oneOf = <T extends string>(values: readonly T[], v: unknown, fallback: T): T => values.find((x) => x === v) ?? fallback;

export function toAthleteRow(r: Raw): AthleteRow {
  return {
    id: text(r.documentId), name: str(r.name), birthDate: str(r.birthDate), contactName: str(r.contactName), phone: str(r.phone), email: str(r.email),
    status: oneOf(ATHLETE_STATUSES, r.status, 'activ'), dataIncomplete: r.dataIncomplete === true, profileId: linkId(r.publicProfile), updatedAt: iso(r.updatedAt) ?? '',
  };
}

const confirmationOf = (v: unknown): ConfirmationRecord | null =>
  v && typeof v === 'object' && typeof (v as Raw).athleteId === 'string' ? (v as ConfirmationRecord) : null;
const answerOf = (v: unknown): 'da' | 'nu' | null => (v === 'da' || v === 'nu' ? v : null);
const levelOf = (v: unknown): 'sigur' | 'probabil' | null => (v === 'sigur' || v === 'probabil' ? v : null);

export function toRegistrationRow(r: Raw): RegistrationRow {
  return {
    id: text(r.documentId), number: str(r.registrationNumber), childName: text(r.childName), childBirthDate: text(r.childBirthDate),
    parentName: text(r.parentName), phone: text(r.phone), email: text(r.email), status: oneOf(STATUSES, r.status, 'Nou'), archived: r.archived === true,
    season: str(r.season), seasonId: linkId(r.seasonRef), sectionId: linkId(r.section), athleteId: linkId(r.athlete), matchAthleteId: linkId(r.matchAthlete),
    matchLevel: levelOf(r.matchLevel), childBirthDateParsed: str(r.childBirthDateParsed), membershipAnswer: answerOf(r.membershipAnswer),
    lastSeason: str(r.lastSeason), subscriptionChoice: r.subscriptionChoice ?? null, confirmation: confirmationOf(r.confirmation), submittedAt: iso(r.submittedAt),
  };
}

const slugList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

export function toProfileRows(rows: Raw[]): ProfileRow[] {
  const byId = new Map<string, ProfileRow>();
  for (const r of rows) {
    const id = text(r.documentId);
    const before = byId.get(id);
    const published = r.publishedAt !== null && r.publishedAt !== undefined;
    byId.set(id, {
      id, name: text(r.name), slug: text(r.slug),
      previousSlugs: slugList(r.previousSlugs).length ? slugList(r.previousSlugs) : before?.previousSlugs ?? [],
      showPublicPage: published ? r.showPublicPage === true : before?.showPublicPage === true,
      published: published || before?.published === true,
    });
  }
  return [...byId.values()];
}

const toMembership = (r: Raw): MembershipRow => ({
  id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', groupId: linkId(r.group) ?? '', seasonId: linkId(r.season) ?? '', isMain: r.isMain === true, from: str(r.from),
});
const toAcs = (r: Raw): AcsRow => ({ id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', seasonId: linkId(r.season) ?? '', state: oneOf(ACS_STATES, r.state, 'nu') });
const toHistory = (r: Raw): HistoryRow => ({
  seq: Number(r.id), subjectType: text(r.subjectType), subjectId: text(r.subjectId), action: text(r.action),
  changes: r.changes && typeof r.changes === 'object' ? (r.changes as Record<string, unknown>) : {}, actor: text(r.actor), at: iso(r.at) ?? '',
});

const REGISTRATION_POPULATE: ('athlete' | 'matchAthlete' | 'section' | 'seasonRef')[] = ['athlete', 'matchAthlete', 'section', 'seasonRef'];
const LINKS: ('athlete' | 'group' | 'season')[] = ['athlete', 'group', 'season'];

function registrationReads(strapi: Core.Strapi): Pick<ClubStore, 'registration' | 'registrations'> {
  const regs = () => strapi.documents(REGISTRATION);
  return {
    registration: async (id) => {
      const r = await regs().findOne({ documentId: id, populate: REGISTRATION_POPULATE });
      return r ? toRegistrationRow(r as unknown as Raw) : null;
    },
    registrations: async (where = {}) => {
      const filters = where.athleteId ? { athlete: { documentId: where.athleteId } } : {};
      return raws(await regs().findMany({ filters, populate: REGISTRATION_POPULATE, limit: MAX })).map(toRegistrationRow);
    },
  };
}

function clubReads(strapi: Core.Strapi): Pick<ClubStore, 'athlete' | 'athletes' | 'seasons' | 'sections' | 'groups'> {
  const athletes = () => strapi.documents(ATHLETE);
  return {
    athlete: async (id) => {
      const a = await athletes().findOne({ documentId: id, populate: ['publicProfile'] });
      return a ? toAthleteRow(a as unknown as Raw) : null;
    },
    athletes: async () => raws(await athletes().findMany({ populate: ['publicProfile'], limit: MAX })).map(toAthleteRow),
    seasons: async () => raws(await strapi.documents(SEASON).findMany({ limit: 1000 })).map((s): SeasonRow => ({
      id: text(s.documentId), label: text(s.label), startMonth: text(s.startMonth), endMonth: text(s.endMonth), isCurrent: s.isCurrent === true,
    })),
    sections: async () => raws(await strapi.documents(SECTION).findMany({ limit: 1000 })).map((s): SectionRow => ({
      id: text(s.documentId), name: text(s.name), kind: s.kind === 'club' ? 'club' : 'school', publicPage: s.publicPage === true, order: typeof s.order === 'number' ? s.order : null,
    })),
    groups: async () => raws(await strapi.documents(GROUP).findMany({ populate: ['section'], limit: 1000 })).map((g): GroupRow => ({
      id: text(g.documentId), name: text(g.name), sectionId: linkId(g.section), order: typeof g.order === 'number' ? g.order : null, active: g.active !== false,
    })),
  };
}

function rowReads(strapi: Core.Strapi): Pick<ClubStore, 'memberships' | 'acsRows' | 'duplicates' | 'profiles'> {
  const byAthlete = (athleteId?: string) => (athleteId ? { athlete: { documentId: athleteId } } : {});
  return {
    memberships: async (athleteId) => raws(await strapi.documents(MEMBERSHIP).findMany({ filters: byAthlete(athleteId), populate: LINKS, limit: MAX })).map(toMembership),
    acsRows: async (athleteId) =>
      raws(await strapi.documents(ACS).findMany({ filters: byAthlete(athleteId), populate: ['athlete', 'season'], limit: MAX })).map(toAcs),
    duplicates: async () =>
      raws(await strapi.documents(DUPLICATE).findMany({ populate: ['first', 'second'], limit: MAX }))
        .map((d): DuplicateRow => ({ id: text(d.documentId), firstId: linkId(d.first) ?? '', secondId: linkId(d.second) ?? '' }))
        .filter((d) => d.firstId && d.secondId),
    profiles: async () =>
      toProfileRows(raws(await strapi.db.query(PROFILE).findMany({ select: ['documentId', 'name', 'slug', 'showPublicPage', 'publishedAt', 'previousSlugs'], limit: MAX }))),
  };
}

function historyReads(strapi: Core.Strapi): Pick<ClubStore, 'history' | 'historyByAction' | 'adminNames'> {
  const query = (where: Raw) => strapi.db.query(HISTORY).findMany({ where, orderBy: { id: 'asc' }, limit: MAX });
  return {
    history: async (subjectType, subjectId) => raws(await query({ subjectType, subjectId })).map(toHistory),
    historyByAction: async (action) => raws(await query({ action })).map(toHistory),
    adminNames: async (emails) => {
      const users = raws(await strapi.db.query('admin::user').findMany({ where: { email: { $in: emails } }, select: ['email', 'firstname', 'lastname'] }));
      return Object.fromEntries(users.map((u) => [text(u.email), `${text(u.firstname)} ${text(u.lastname)}`.trim() || text(u.email)]));
    },
  };
}

const PATCH_KEYS: Readonly<Record<string, string>> = { athleteId: 'athlete', matchAthleteId: 'matchAthlete', sectionId: 'section' };
const registrationData = (p: RegistrationPatch): Raw => Object.fromEntries(Object.entries(p).map(([k, v]) => [PATCH_KEYS[k] ?? k, v]));
/** The athlete fields as Strapi names them (`profileId` is the `publicProfile` relation); typed, so `create` type-checks. */
function athleteFields(d: AthleteWrite) {
  const { profileId, ...rest } = d;
  return profileId === undefined ? rest : { ...rest, publicProfile: profileId };
}

function athleteWrites(strapi: Core.Strapi): Pick<ClubStore, 'updateRegistration' | 'createAthlete' | 'updateAthlete' | 'deleteAthlete'> {
  return {
    updateRegistration: async (id, patch) => {
      await strapi.documents(REGISTRATION).update({ documentId: id, data: registrationData(patch) });
    },
    createAthlete: async (data) => (await strapi.documents(ATHLETE).create({ data: { status: 'activ' as const, ...athleteFields(data) } })).documentId,
    updateAthlete: async (id, data) => {
      await strapi.documents(ATHLETE).update({ documentId: id, data: athleteFields(data) });
    },
    deleteAthlete: async (id) => {
      await strapi.documents(ATHLETE).delete({ documentId: id });
    },
  };
}

type RowWrites = 'createMembership' | 'updateMembership' | 'deleteMembership' | 'createAcs' | 'updateAcs' | 'deleteAcs' | 'createDuplicate' | 'deleteDuplicate';

function rowWrites(strapi: Core.Strapi): Pick<ClubStore, RowWrites> {
  const links = (d: { athleteId?: string; groupId?: string; seasonId?: string }) =>
    Object.fromEntries(Object.entries({ athlete: d.athleteId, group: d.groupId, season: d.seasonId }).filter(([, v]) => v !== undefined));
  const del = (uid: typeof MEMBERSHIP | typeof ACS | typeof DUPLICATE) => async (id: string) => {
    await strapi.documents(uid).delete({ documentId: id });
  };
  return {
    createMembership: async (d) => (await strapi.documents(MEMBERSHIP).create({ data: { ...links(d), isMain: d.isMain, from: d.from } })).documentId,
    updateMembership: async (id, d) => {
      await strapi.documents(MEMBERSHIP).update({ documentId: id, data: { ...links(d), ...(d.isMain === undefined ? {} : { isMain: d.isMain }) } });
    },
    deleteMembership: del(MEMBERSHIP),
    createAcs: async (d) => (await strapi.documents(ACS).create({ data: { ...links(d), state: d.state } })).documentId,
    updateAcs: async (id, d) => {
      await strapi.documents(ACS).update({ documentId: id, data: { ...links(d), ...(d.state === undefined ? {} : { state: d.state }) } });
    },
    deleteAcs: del(ACS),
    createDuplicate: async (firstId, secondId) => {
      await strapi.documents(DUPLICATE).create({ data: { first: firstId, second: secondId } });
    },
    deleteDuplicate: del(DUPLICATE),
  };
}

/** A deleted profile takes its competition participations with it (spec 6.6); the competition lifecycle re-syncs the relation. */
async function removeParticipations(strapi: Core.Strapi, profileId: string): Promise<void> {
  const competitions = raws(await strapi.documents(COMPETITION).findMany({ fields: ['participantData'], limit: MAX }));
  for (const c of competitions) {
    const list = Array.isArray(c.participantData) ? c.participantData : [];
    const kept = list.filter((p) => !(p && typeof p === 'object' && (p as Raw).documentId === profileId));
    if (kept.length !== list.length) await strapi.documents(COMPETITION).update({ documentId: text(c.documentId), data: { participantData: kept } });
  }
}

function profileWrites(strapi: Core.Strapi): Pick<ClubStore, 'createProfile' | 'renameProfile' | 'setProfileVisibility' | 'setPreviousSlugs' | 'deleteProfile'> {
  const bothRows = async (id: string, data: Raw) => {
    await strapi.db.query(PROFILE).updateMany({ where: { documentId: id }, data });
  };
  return {
    createProfile: async (name, slug) => (await strapi.documents(PROFILE).create({ data: { name, slug, showPublicPage: false }, status: 'published' })).documentId,
    renameProfile: (id, name) => bothRows(id, { name }),
    setProfileVisibility: (id, on) => bothRows(id, { showPublicPage: on }),
    setPreviousSlugs: (id, slugs) => bothRows(id, { previousSlugs: slugs }),
    deleteProfile: async (id) => {
      await removeParticipations(strapi, id);
      await strapi.documents(PROFILE).delete({ documentId: id });
    },
  };
}

/** ClubStore on Strapi: document service for writes (validation, lifecycles), db queries for bulk reads. */
export function strapiClubStore(strapi: Core.Strapi): ClubStore {
  let active: Knex.Transaction | null = null;
  return {
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      return await strapi.db.transaction(async ({ trx }: { trx: Knex.Transaction }) => {
        active = trx;
        try {
          return await work();
        } finally {
          active = null;
        }
      });
    },
    lockRegistration: async (id) => {
      if (active) await strapi.db.connection('registration_submissions').transacting(active).forUpdate().where('document_id', id).select('id');
    },
    ...registrationReads(strapi),
    ...clubReads(strapi),
    ...rowReads(strapi),
    ...historyReads(strapi),
    ...athleteWrites(strapi),
    ...rowWrites(strapi),
    ...profileWrites(strapi),
    moveHistory: async (from, to) => {
      await strapi.db.query(HISTORY).updateMany({ where: { subjectType: 'athlete', subjectId: from }, data: { subjectId: to } });
    },
    record: (entry) => recordHistory(strapi, entry),
  };
}
```

Every write inside `transaction` joins it: Strapi 5 keeps the transaction in an AsyncLocalStorage context (`@strapi/database` `transactionCtx`), which the document service and `db.query` both read. Only the raw `connection(...)` call needs `transacting(active)`.

`src/club/athletes/http.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { adminActor } from '../admin-actor';
import type { AdminCtx } from '../admin-http';
import { todayInBucharest } from '../birth-date';
import type { ClubStore, ServiceContext } from './store';
import { strapiClubStore } from './strapi-store';

/** What the club controllers pass to the services. */
export const clubStore = (strapi: Core.Strapi): ClubStore => strapiClubStore(strapi);

export async function serviceContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<ServiceContext> {
  return {
    store: strapiClubStore(strapi),
    actor: await adminActor(ctx.request.header.authorization, strapi),
    today: todayInBucharest(),
    log: (message) => strapi.log.error(message),
  };
}

export const queryText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
```

`src/club/athletes/__tests__/fake-store.ts`:

```ts
import type { HistoryInput } from '../../history';
import type {
  AcsRow, AthleteRow, ClubStore, DuplicateRow, GroupRow, HistoryRow, MembershipRow, ProfileRow, RegistrationRow, SeasonRow, SectionRow,
} from '../store';

/** In-memory ClubStore for the service tests. A transaction restores a snapshot when its work throws. */
export type FakeState = {
  athletes: AthleteRow[]; registrations: RegistrationRow[]; seasons: SeasonRow[]; sections: SectionRow[]; groups: GroupRow[];
  memberships: MembershipRow[]; acs: AcsRow[]; duplicates: DuplicateRow[]; profiles: ProfileRow[]; history: HistoryRow[];
  removedParticipations: string[]; locks: string[]; admins: Record<string, string>;
};
export type Fake = { store: ClubStore; state: FakeState; failOn(method: keyof ClubStore): void };

export const SEASONS: SeasonRow[] = [
  { id: 's25', label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31', isCurrent: false },
  { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true },
];
export const SECTIONS: SectionRow[] = [
  { id: 'afi', name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', publicPage: true, order: 1 },
  { id: 'club', name: 'Club', kind: 'club', publicPage: false, order: 2 },
];
export const GROUPS: GroupRow[] = [
  { id: 'g-pp', name: 'Primii Pași', sectionId: 'afi', order: 1, active: true },
  { id: 'g-ib', name: 'Intermediari Bronze', sectionId: 'afi', order: 2, active: true },
  { id: 'g-pro', name: 'Profesioniști', sectionId: 'club', order: 1, active: true },
];

const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export function athleteRow(over: Partial<AthleteRow> & { id: string }): AthleteRow {
  const base: AthleteRow = { id: over.id, name: null, birthDate: null, contactName: null, phone: null, email: null, status: 'activ', dataIncomplete: true, profileId: null, updatedAt: '2026-10-01T10:00:00.000Z' };
  return { ...base, ...defined(over) };
}

export function registrationRow(over: Partial<RegistrationRow> & { id: string }): RegistrationRow {
  const base: RegistrationRow = {
    id: over.id, number: '2026-0142', childName: 'Maria Pop', childBirthDate: '14.03.2016', parentName: 'Ana Pop', phone: '0722111222', email: 'ana@example.com',
    status: 'Nou', archived: false, season: '2026-2027', seasonId: 's26', sectionId: 'afi', athleteId: null, matchAthleteId: null, matchLevel: null,
    childBirthDateParsed: null, membershipAnswer: 'da', lastSeason: null, subscriptionChoice: null, confirmation: null, submittedAt: '2026-10-03T11:22:00.000Z',
  };
  return { ...base, ...defined(over) };
}

function must<T extends { id: string }>(rows: T[], id: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`fake: no row ${id}`);
  return row;
}

type Reads = 'registration' | 'registrations' | 'athlete' | 'athletes' | 'seasons' | 'sections' | 'groups' | 'memberships' | 'acsRows' | 'duplicates' | 'profiles' | 'history' | 'historyByAction' | 'adminNames';

function fakeReads(s: FakeState): Pick<ClubStore, Reads> {
  const copy = <T>(v: T): T => structuredClone(v);
  return {
    registration: async (id) => copy(s.registrations.find((r) => r.id === id) ?? null),
    registrations: async (where = {}) => copy(s.registrations.filter((r) => !where.athleteId || r.athleteId === where.athleteId)),
    athlete: async (id) => copy(s.athletes.find((a) => a.id === id) ?? null),
    athletes: async () => copy(s.athletes),
    seasons: async () => copy(s.seasons),
    sections: async () => copy(s.sections),
    groups: async () => copy(s.groups),
    memberships: async (athleteId) => copy(s.memberships.filter((m) => !athleteId || m.athleteId === athleteId)),
    acsRows: async (athleteId) => copy(s.acs.filter((r) => !athleteId || r.athleteId === athleteId)),
    duplicates: async () => copy(s.duplicates),
    profiles: async () => copy(s.profiles),
    history: async (type, id) => copy(s.history.filter((h) => h.subjectType === type && h.subjectId === id)),
    historyByAction: async (action) => copy(s.history.filter((h) => h.action === action)),
    adminNames: async (emails) => Object.fromEntries(emails.filter((e) => s.admins[e]).map((e) => [e, s.admins[e]])),
  };
}

type Next = (prefix: string) => string;

function fakeAthleteWrites(s: FakeState, next: Next, tick: () => string): Pick<ClubStore, 'updateRegistration' | 'createAthlete' | 'updateAthlete' | 'deleteAthlete'> {
  return {
    updateRegistration: async (id, patch) => {
      Object.assign(must(s.registrations, id), patch);
    },
    createAthlete: async (data) => {
      const id = next('ath');
      s.athletes.push(athleteRow({ ...data, id, updatedAt: tick() }));
      return id;
    },
    updateAthlete: async (id, data) => {
      Object.assign(must(s.athletes, id), defined(data), { updatedAt: tick() });
    },
    deleteAthlete: async (id) => {
      must(s.athletes, id);
      s.athletes = s.athletes.filter((a) => a.id !== id);
      for (const r of s.registrations) Object.assign(r, r.athleteId === id ? { athleteId: null } : {}, r.matchAthleteId === id ? { matchAthleteId: null, matchLevel: null } : {});
    },
  };
}

function fakeRowWrites(s: FakeState, next: Next): Pick<ClubStore, 'createMembership' | 'updateMembership' | 'deleteMembership' | 'createAcs' | 'updateAcs' | 'deleteAcs' | 'createDuplicate' | 'deleteDuplicate'> {
  return {
    createMembership: async (data) => {
      const id = next('gm');
      s.memberships.push({ ...data, id });
      return id;
    },
    updateMembership: async (id, data) => {
      Object.assign(must(s.memberships, id), defined(data));
    },
    deleteMembership: async (id) => {
      s.memberships = s.memberships.filter((m) => m.id !== id);
    },
    createAcs: async (data) => {
      const id = next('acs');
      s.acs.push({ ...data, id });
      return id;
    },
    updateAcs: async (id, data) => {
      Object.assign(must(s.acs, id), defined(data));
    },
    deleteAcs: async (id) => {
      s.acs = s.acs.filter((r) => r.id !== id);
    },
    createDuplicate: async (firstId, secondId) => {
      s.duplicates.push({ id: next('dup'), firstId, secondId });
    },
    deleteDuplicate: async (id) => {
      s.duplicates = s.duplicates.filter((d) => d.id !== id);
    },
  };
}

function fakeProfileWrites(s: FakeState, next: Next): Pick<ClubStore, 'createProfile' | 'renameProfile' | 'setProfileVisibility' | 'setPreviousSlugs' | 'deleteProfile'> {
  return {
    createProfile: async (name, slug) => {
      const id = next('sp');
      s.profiles.push({ id, name, slug, previousSlugs: [], showPublicPage: false, published: true });
      return id;
    },
    renameProfile: async (id, name) => {
      must(s.profiles, id).name = name;
    },
    setProfileVisibility: async (id, on) => {
      must(s.profiles, id).showPublicPage = on;
    },
    setPreviousSlugs: async (id, slugs) => {
      must(s.profiles, id).previousSlugs = [...slugs];
    },
    deleteProfile: async (id) => {
      s.profiles = s.profiles.filter((p) => p.id !== id);
      s.removedParticipations.push(id);
    },
  };
}

function fakeHistory(s: FakeState, tick: () => string): Pick<ClubStore, 'moveHistory' | 'record'> {
  return {
    moveHistory: async (from, to) => {
      for (const h of s.history) if (h.subjectType === 'athlete' && h.subjectId === from) h.subjectId = to;
    },
    record: async (entry: HistoryInput) => {
      const seq = s.history.reduce((max, h) => Math.max(max, h.seq), 0) + 1;
      s.history.push({ seq, subjectType: entry.subjectType, subjectId: entry.subjectId, action: entry.action, changes: entry.changes ?? {}, actor: entry.actor, at: tick() });
    },
  };
}

function withFailures(store: ClubStore, failing: Set<string>): ClubStore {
  const wrapped: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(store) as [string, (...args: unknown[]) => Promise<unknown>][]) {
    wrapped[key] = (...args: unknown[]) => (failing.delete(key) ? Promise.reject(new Error(`fake failure in ${key}`)) : fn(...args));
  }
  return wrapped as unknown as ClubStore;
}

const EMPTY: FakeState = {
  athletes: [], registrations: [], seasons: SEASONS, sections: SECTIONS, groups: GROUPS, memberships: [], acs: [], duplicates: [],
  profiles: [], history: [], removedParticipations: [], locks: [], admins: {},
};

export function fakeClubStore(seed: Partial<FakeState> = {}): Fake {
  const state: FakeState = structuredClone({ ...EMPTY, ...seed });
  const failing = new Set<string>();
  let n = 0;
  const next: Next = (prefix) => `${prefix}-${(n += 1)}`;
  const tick = () => new Date(Date.UTC(2026, 9, 26, 12, 0, 0) + (n += 1) * 1000).toISOString();
  const base: ClubStore = {
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      const snapshot = structuredClone(state);
      try {
        return await work();
      } catch (err) {
        Object.assign(state, snapshot);
        throw err;
      }
    },
    lockRegistration: async (id) => {
      state.locks.push(id);
    },
    ...fakeReads(state), ...fakeAthleteWrites(state, next, tick), ...fakeRowWrites(state, next), ...fakeProfileWrites(state, next), ...fakeHistory(state, tick),
  };
  return { store: withFailures(base, failing), state, failOn: (method) => failing.add(method) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit`
Expected: PASS, zero type errors. If `tsc` rejects a `populate` array literal for one content type, give that array an explicit union type like `REGISTRATION_POPULATE` (the pattern `src/email/strapi-email.ts` uses for `POPULATE`).

- [ ] **Step 5: Commit**

```bash
git add src/club/admin-result.ts src/club/athletes
git commit -m "feat(club): ClubStore on Strapi and in memory, admin API types"
```

---
### Task 12: Saved matching and the submit hook

**Files:**
- Create: `src/club/athletes/matches.ts`, `src/club/athletes/registration-hooks.ts`
- Modify: `src/api/registration-submission/controllers/registration-submission.ts` (`submitPublic`, imports)
- Test: `src/club/athletes/__tests__/matches.test.ts`, `src/api/registration-submission/__tests__/submit-hook-wiring.test.ts`

**Interfaces:**
- Consumes: `bestMatch`, `registrationFacts`, `AthleteFacts` (Task 4); `birthDateSortKey` (Task 2); `ClubStore`, `AthleteRow`, `RegistrationRow`, `RegistrationPatch` (Task 11); `HISTORY_ACTIONS`, `SUBJECT`, `FORM_ACTOR` (Task 6); `clubStore` (Task 11).
- Produces:
  - `athleteFacts(a: AthleteRow): AthleteFacts`
  - `planMatchUpdates(registrations: RegistrationRow[], athletes: AthleteRow[]): { registrationId: string; patch: RegistrationPatch }[]` (also used by deploy step 10)
  - `refreshAllMatches(store: ClubStore): Promise<number>`, `refreshRegistrationMatch(store: ClubStore, id: string): Promise<void>`
  - `safely(work: () => Promise<unknown>, log: (message: string) => void, what: string): Promise<void>` (never throws)
  - `afterRegistrationSubmitted(store: ClubStore, registrationId: string, log: (message: string) => void): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`src/club/athletes/__tests__/matches.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { planMatchUpdates, refreshAllMatches, refreshRegistrationMatch, safely } from '../matches';
import { afterRegistrationSubmitted } from '../registration-hooks';
import { athleteRow, fakeClubStore, registrationRow } from './fake-store';

const maria = athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', status: 'inactiv' });

describe('planMatchUpdates (spec 2.1, 2.2)', () => {
  it('saves the best Sigur or Probabil match and the parsed birth date; inactive athletes count', () => {
    expect(planMatchUpdates([registrationRow({ id: 'r1' })], [maria])).toEqual([
      { registrationId: 'r1', patch: { matchAthleteId: 'a1', matchLevel: 'sigur', childBirthDateParsed: '2016-03-14' } },
    ]);
  });

  it('clears the match of a linked registration and writes nothing when unchanged', () => {
    const linked = registrationRow({ id: 'r1', athleteId: 'a1', matchAthleteId: 'a1', matchLevel: 'sigur', childBirthDateParsed: '2016-03-14' });
    const same = registrationRow({ id: 'r2', matchAthleteId: 'a1', matchLevel: 'sigur', childBirthDateParsed: '2016-03-14' });
    expect(planMatchUpdates([linked, same], [maria])).toEqual([
      { registrationId: 'r1', patch: { matchAthleteId: null, matchLevel: null, childBirthDateParsed: '2016-03-14' } },
    ]);
  });

  it('empties the parsed date when the text became unreadable', () => {
    const stale = registrationRow({ id: 'r1', childBirthDate: 'ieri', childBirthDateParsed: '2016-03-14' });
    expect(planMatchUpdates([stale], [])).toEqual([{ registrationId: 'r1', patch: { matchAthleteId: null, matchLevel: null, childBirthDateParsed: null } }]);
  });
});

describe('refresh (spec 2.2)', () => {
  it('rewrites only the registrations whose match changed', async () => {
    const fake = fakeClubStore({ athletes: [maria], registrations: [registrationRow({ id: 'r1' }), registrationRow({ id: 'r2', childName: 'Ion Ilie' })] });
    expect(await refreshAllMatches(fake.store)).toBe(2);
    expect(fake.state.registrations.map((r) => [r.id, r.matchLevel])).toEqual([['r1', 'sigur'], ['r2', null]]);
    expect(await refreshAllMatches(fake.store)).toBe(0);
  });

  it('refreshes one registration', async () => {
    const fake = fakeClubStore({ athletes: [maria], registrations: [registrationRow({ id: 'r1' })] });
    await refreshRegistrationMatch(fake.store, 'r1');
    expect(fake.state.registrations[0].matchAthleteId).toBe('a1');
  });

  it('safely logs a failure and never throws', async () => {
    const log = vi.fn();
    await safely(async () => { throw new Error('boom'); }, log, 'refresh');
    expect(log).toHaveBeenCalledWith('[athletes] refresh failed: boom');
  });
});

describe('after a public submit', () => {
  it('writes "Înscriere înregistrată" and saves the match', async () => {
    const fake = fakeClubStore({ athletes: [maria], registrations: [registrationRow({ id: 'r1' })] });
    await afterRegistrationSubmitted(fake.store, 'r1', vi.fn());
    expect(fake.state.history.map((h) => [h.subjectId, h.action, h.actor])).toEqual([['r1', 'submitted', 'formular']]);
    expect(fake.state.registrations[0].matchLevel).toBe('sigur');
  });

  it('never fails the submit', async () => {
    const fake = fakeClubStore({ registrations: [registrationRow({ id: 'r1' })] });
    fake.failOn('record');
    const log = vi.fn();
    await afterRegistrationSubmitted(fake.store, 'r1', log);
    expect(log).toHaveBeenCalledOnce();
  });
});
```

`src/api/registration-submission/__tests__/submit-hook-wiring.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const controller = readFileSync(join(__dirname, '..', 'controllers/registration-submission.ts'), 'utf8');
const submit = controller.slice(controller.indexOf('async submitPublic('), controller.indexOf('async list('));

it('records the submit and matches it, only for a new registration (not a repeat of the same draft)', () => {
  expect(submit).toContain('if (saved.ok === true && !saved.repeat) await afterRegistrationSubmitted(clubStore(strapi), saved.documentId');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/athletes/__tests__/matches.test.ts src/api/registration-submission/__tests__/submit-hook-wiring.test.ts`
Expected: FAIL ("Cannot find module '../matches'"; the wiring line is missing).

- [ ] **Step 3: Write the implementation**

`src/club/athletes/matches.ts`:

```ts
import { birthDateSortKey } from '../birth-date';
import { bestMatch, registrationFacts, type AthleteFacts } from '../matching';
import type { AthleteRow, ClubStore, RegistrationPatch, RegistrationRow } from './store';

/** The saved match of every registration (spec 2.2): at submit, on edit, after any athlete change, at deploy. */
export type MatchUpdate = { registrationId: string; patch: RegistrationPatch };

export const athleteFacts = (a: AthleteRow): AthleteFacts => ({ id: a.id, name: a.name ?? '', birthDate: a.birthDate, phone: a.phone, email: a.email, updatedAt: a.updatedAt });

/** A linked registration keeps no match: the "Sportiv existent" line is only for unconfirmed ones (gaps #16, P6). */
function matchPatch(r: RegistrationRow, facts: AthleteFacts[]): RegistrationPatch | null {
  const best = r.athleteId ? null : bestMatch(registrationFacts(r), facts);
  const next = { matchAthleteId: best?.athleteId ?? null, matchLevel: best?.level ?? null, childBirthDateParsed: birthDateSortKey(r.childBirthDate) };
  const same = next.matchAthleteId === r.matchAthleteId && next.matchLevel === r.matchLevel && next.childBirthDateParsed === r.childBirthDateParsed;
  return same ? null : next;
}

export function planMatchUpdates(registrations: RegistrationRow[], athletes: AthleteRow[]): MatchUpdate[] {
  const facts = athletes.map(athleteFacts);
  return registrations.flatMap((r) => {
    const patch = matchPatch(r, facts);
    return patch ? [{ registrationId: r.id, patch }] : [];
  });
}

export async function refreshAllMatches(store: ClubStore): Promise<number> {
  const [registrations, athletes] = await Promise.all([store.registrations(), store.athletes()]);
  const updates = planMatchUpdates(registrations, athletes);
  for (const u of updates) await store.updateRegistration(u.registrationId, u.patch);
  return updates.length;
}

export async function refreshRegistrationMatch(store: ClubStore, id: string): Promise<void> {
  const [registration, athletes] = await Promise.all([store.registration(id), store.athletes()]);
  const [update] = registration ? planMatchUpdates([registration], athletes) : [];
  if (update) await store.updateRegistration(id, update.patch);
}

/** Matching and its history are a convenience after the real write: a failure is logged, never thrown. */
export async function safely(work: () => Promise<unknown>, log: (message: string) => void, what: string): Promise<void> {
  try {
    await work();
  } catch (err) {
    log(`[athletes] ${what} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
```

`src/club/athletes/registration-hooks.ts`:

```ts
import { FORM_ACTOR, HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { refreshRegistrationMatch, safely } from './matches';
import type { ClubStore } from './store';

/** After a new public registration (not a repeat of the same draft): "Înscriere înregistrată" and its match (spec 1.6, 2.2). */
export async function afterRegistrationSubmitted(store: ClubStore, registrationId: string, log: (message: string) => void): Promise<void> {
  await safely(
    async () => {
      await store.record({ subjectType: SUBJECT.registration, subjectId: registrationId, action: HISTORY_ACTIONS.submitted, actor: FORM_ACTOR });
      await refreshRegistrationMatch(store, registrationId);
    },
    log,
    `after submit of ${registrationId}`,
  );
}
```

In `src/api/registration-submission/controllers/registration-submission.ts`, add the imports:

```ts
import { clubStore } from '../../../club/athletes/http';
import { afterRegistrationSubmitted } from '../../../club/athletes/registration-hooks';
```

and in `submitPublic`, right after `const saved = await submitRegistration(body, slug, buildSubmitDeps(strapi));`, add:

```ts
    if (saved.ok === true && !saved.repeat) await afterRegistrationSubmitted(clubStore(strapi), saved.documentId, (m) => strapi.log.error(m));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club/athletes src/api/registration-submission && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/matches.ts src/club/athletes/registration-hooks.ts src/club/athletes/__tests__/matches.test.ts src/api/registration-submission
git commit -m "feat(inscrieri): match at submit and save it; Înscriere înregistrată in Istoric"
```

---

### Task 13: History read routes

**Files:**
- Create: `src/club/athletes/history-read.ts`, `src/api/club/controllers/registrations.ts`, `src/api/club/controllers/athletes.ts`, `src/api/club/routes/04-registrations.ts`, `src/api/club/routes/05-athletes.ts`
- Test: `src/club/athletes/__tests__/history-read.test.ts`, `src/club/__tests__/athlete-routes.test.ts`

**Interfaces:**
- Consumes: `historyTexts`, `actorLabel`, `HISTORY_ACTIONS`, `SUBJECT`, `FORM_ACTOR` (Task 6); `ClubStore`, `HistoryRow`, `HistoryLine`, `clubStore` (Task 11); `refuseWith`, `AdminCtx`; `ADMIN_ERRORS`.
- Produces:
  - `readHistory(store: ClubStore, subjectType: string, subjectId: string, submittedAt?: string | null): Promise<HistoryLine[]>` (newest first; ties keep write order)
  - `GET /api/club/registrations/:documentId/history` (handler `registrations.history`), `GET /api/club/athletes/:documentId/history` (handler `athletes.history`); both 404 for an unknown or deleted record (gaps #40).
  - The two route files and controllers later tasks add to. Rule kept by the test: in `05-athletes.ts`, every path without `/:documentId` comes before the first `/club/athletes/:documentId` path; in `04-registrations.ts` the bulk path comes before the `/:documentId` ones.

- [ ] **Step 1: Write the failing tests**

`src/club/athletes/__tests__/history-read.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readHistory } from '../history-read';
import { fakeClubStore } from './fake-store';

describe('Istoric (spec 1.6, 3b Q23)', () => {
  it('newest first, actor by name, several lines of one entry kept in order', async () => {
    const fake = fakeClubStore({ admins: { 'ana@club.ro': 'Ana Pop' } });
    await fake.store.record({ subjectType: 'athlete', subjectId: 'a1', action: 'created-from-profile', actor: 'migrare' });
    await fake.store.record({ subjectType: 'athlete', subjectId: 'a1', action: 'updated', actor: 'ana@club.ro', changes: { fields: { phone: { from: null, to: '07' }, email: { from: null, to: 'e' } } } });
    const lines = await readHistory(fake.store, 'athlete', 'a1');
    expect(lines.map((l) => [l.actor, l.text])).toEqual([
      ['Ana Pop', 'Telefon: "" → "07"'],
      ['Ana Pop', 'E-mail: "" → "e"'],
      ['Migrare', 'Fișă creată din profilul public existent'],
    ]);
  });

  it('shows "Înscriere înregistrată" from submittedAt for an older registration without the row (r4 e10)', async () => {
    const fake = fakeClubStore();
    await fake.store.record({ subjectType: 'registration-submission', subjectId: 'r1', action: 'document-rebuilt', actor: 'ana@club.ro', changes: { documents: [] } });
    const lines = await readHistory(fake.store, 'registration-submission', 'r1', '2026-10-03T11:22:00.000Z');
    expect(lines.map((l) => l.text)).toEqual(['Document refăcut', 'Înscriere înregistrată']);
    expect(lines[1].at).toBe('2026-10-03T11:22:00.000Z');
  });

  it('does not add it twice', async () => {
    const fake = fakeClubStore();
    await fake.store.record({ subjectType: 'registration-submission', subjectId: 'r1', action: 'submitted', actor: 'formular' });
    expect(await readHistory(fake.store, 'registration-submission', 'r1', '2026-10-03T11:22:00.000Z')).toHaveLength(1);
  });
});
```

`src/club/__tests__/athlete-routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import athletes from '../../api/club/controllers/athletes';
import registrations from '../../api/club/controllers/registrations';
import athleteRoutes from '../../api/club/routes/05-athletes';
import registrationRoutes from '../../api/club/routes/04-registrations';

const controllers: Record<string, Record<string, unknown>> = { athletes, registrations };
const all = [...registrationRoutes.routes, ...athleteRoutes.routes];
const fromFirst = (paths: string[], test: (p: string) => boolean) => paths.slice(paths.findIndex(test));

describe('3A+3B admin routes', () => {
  it('are all admin-only', () => {
    for (const r of all) expect(r.config).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
  });

  it('point at handlers that exist', () => {
    for (const r of all) {
      const [controller, action] = r.handler.split('.');
      expect(typeof controllers[controller]?.[action], r.handler).toBe('function');
    }
  });

  it('list fixed athlete paths before /:documentId ones, so "search" is never read as an id', () => {
    const paths = athleteRoutes.routes.map((r) => r.path);
    expect(fromFirst(paths, (p) => p.startsWith('/club/athletes/:documentId')).every((p) => p.startsWith('/club/athletes/:documentId'))).toBe(true);
  });

  it('list the bulk registration paths before the per-registration ones', () => {
    const paths = registrationRoutes.routes.map((r) => r.path);
    expect(fromFirst(paths, (p) => p.includes(':documentId')).every((p) => p.includes(':documentId'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/athletes/__tests__/history-read.test.ts src/club/__tests__/athlete-routes.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the implementation**

`src/club/athletes/history-read.ts`:

```ts
import { FORM_ACTOR, HISTORY_ACTIONS, SUBJECT, actorLabel, historyTexts } from '../history-text';
import type { HistoryLine } from './api-types';
import type { ClubStore, HistoryRow } from './store';

type Line = HistoryLine & { seq: number };

function linesOf(row: HistoryRow, names: Readonly<Record<string, string>>): Line[] {
  return historyTexts(row.action, row.changes, row.subjectType).map((text) => ({ at: row.at, actor: actorLabel(row.actor, names), text, seq: row.seq }));
}

/** Older registrations have no stored submit row: shown from `submittedAt` (r4 e10). */
function submittedLine(rows: HistoryRow[], submittedAt: string | null): Line[] {
  if (!submittedAt || rows.some((r) => r.action === HISTORY_ACTIONS.submitted)) return [];
  return [{ at: submittedAt, actor: actorLabel(FORM_ACTOR, {}), text: 'Înscriere înregistrată', seq: 0 }];
}

const newestFirst = (a: Line, b: Line) => b.at.localeCompare(a.at) || a.seq - b.seq;

/** Istoric of a registration or an athlete: newest first, one line per change, actor by name (3b Q23). */
export async function readHistory(store: ClubStore, subjectType: string, subjectId: string, submittedAt: string | null = null): Promise<HistoryLine[]> {
  const rows = await store.history(subjectType, subjectId);
  const emails = [...new Set(rows.map((r) => r.actor).filter((a) => a.includes('@')))];
  const names = emails.length ? await store.adminNames(emails) : {};
  const synthetic = subjectType === SUBJECT.registration ? submittedLine(rows, submittedAt) : [];
  return [...rows.flatMap((r) => linesOf(r, names)), ...synthetic].sort(newestFirst).map(({ at, actor, text }) => ({ at, actor, text }));
}
```

`src/api/club/controllers/registrations.ts`:

```ts
import { refuseWith, type AdminCtx } from '../../../club/admin-http';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { readHistory } from '../../../club/athletes/history-read';
import { clubStore } from '../../../club/athletes/http';
import { SUBJECT } from '../../../club/history-text';

/** Admin API of the Înscrieri confirmation (routes/04-registrations.ts, all `global::is-admin`). */
export default {
  async history(ctx: AdminCtx) {
    const store = clubStore(strapi);
    const id = ctx.params.documentId ?? '';
    const registration = await store.registration(id);
    if (!registration) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    ctx.body = { data: await readHistory(store, SUBJECT.registration, id, registration.submittedAt) };
  },
};
```

`src/api/club/controllers/athletes.ts`:

```ts
import { refuseWith, type AdminCtx } from '../../../club/admin-http';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { readHistory } from '../../../club/athletes/history-read';
import { clubStore } from '../../../club/athletes/http';
import { SUBJECT } from '../../../club/history-text';

/** Admin API of Sportivi (routes/05-athletes.ts, all `global::is-admin`). A deleted athlete is not found (gaps #40). */
export default {
  async history(ctx: AdminCtx) {
    const store = clubStore(strapi);
    const id = ctx.params.documentId ?? '';
    if (!(await store.athlete(id))) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    ctx.body = { data: await readHistory(store, SUBJECT.athlete, id) };
  },
};
```

`src/api/club/routes/04-registrations.ts`:

```ts
/**
 * Admin API of the Înscrieri confirmation (spec 3, 4). Content-api routes (under /api) with auth off and the
 * `global::is-admin` policy. Bulk paths first, then the per-registration ones.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/registrations/:documentId/history', handler: 'registrations.history', config: adminGuard },
  ],
};
```

`src/api/club/routes/05-athletes.ts`:

```ts
/**
 * Admin API of Sportivi (spec 5, 6). Content-api routes (under /api) with auth off and the `global::is-admin`
 * policy. Fixed paths (search, merge, by-profile) come before `/club/athletes/:documentId`.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/athletes/:documentId/history', handler: 'athletes.history', config: adminGuard },
  ],
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/history-read.ts src/club/athletes/__tests__/history-read.test.ts src/club/__tests__/athlete-routes.test.ts src/api/club/controllers/registrations.ts src/api/club/controllers/athletes.ts src/api/club/routes/04-registrations.ts src/api/club/routes/05-athletes.ts
git commit -m "feat(club): Istoric read routes for registrations and athletes"
```

---

### Task 14: Registration edits with old -> new history, and the delete note

**Files:**
- Create: `src/club/registration-update.ts`, `src/api/registration-submission/edit-deps.ts`
- Modify: `src/club/athletes/registration-hooks.ts` (add `beforeRegistrationDeleted`)
- Modify: `src/api/registration-submission/controllers/registration-submission.ts` (`updateSubmission`, `deleteSubmission`, `deleteArchivedSeason`; remove `STATUSES`, `EDITABLE_FIELDS`, `recordDocumentRebuilt` and the imports only they used)
- Modify: `src/club/__tests__/registration-edit.test.ts` (its last test reads the controller code that moves out)
- Test: `src/club/__tests__/registration-update.test.ts`, `src/api/registration-submission/__tests__/edit-wiring.test.ts`, `src/club/athletes/__tests__/registration-hooks.test.ts`

**Interfaces:**
- Consumes: `REGISTRATION_EDIT_FIELDS`, `REGISTRATION_EDIT_ERROR`, `registrationEditError`, `normalizeRegistrationEdit`, `documentRebuiltEntry` (`src/club/registration-edit.ts`); `LAST_SEASON_OPTIONS`; `parseChildHeight`; `RebuildResult`, `rebuildAfterEdit`, `seasonIdForLabel` (`src/club/documents`); `birthDateSortKey`; `HISTORY_ACTIONS`, `SUBJECT`; `refreshRegistrationMatch`, `safely`, `clubStore`; `adminActor`; `FieldChange`.
- Produces:
  - `EDITABLE_FIELDS: ReadonlySet<string>` (today's list plus `childHeight`, `lastSeason`), `SETTABLE_STATUSES = ['Nou', 'Contactat', 'Respins']`, `STATUS_ERROR = 'Stare invalidă.'`
  - `type RegistrationEditDeps = { find(id): Promise<Record<string, unknown> | null>; save(id, data): Promise<Record<string, unknown> | null>; seasonIdForLabel(label: unknown): Promise<string | null>; rebuild(id, data): Promise<RebuildResult | null>; record(entry: HistoryInput): Promise<void>; refreshMatch(id: string): Promise<void>; log(message: string): void }`
  - `updateRegistration(deps, id, raw, actor): Promise<RegistrationEditResult>` where `RegistrationEditResult = { ok: true; data: Record<string, unknown>; rebuild: RebuildResult | null; changed: string[] } | { ok: false; status: 400 | 404; error: string }`
  - `registrationEditDeps(strapi: Core.Strapi): RegistrationEditDeps`
  - `beforeRegistrationDeleted(store, registrationId, actor, log): Promise<void>`
  - PUT `/api/forms/inscrieri/:documentId` answers `{ data, rebuild?, changed: string[] }`; status "Confirmat" is refused with 400 "Stare invalidă." (spec 3.2, 3.5).

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/registration-update.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { HistoryInput } from '../history';
import { REGISTRATION_EDIT_ERROR } from '../registration-edit';
import { STATUS_ERROR, updateRegistration, type RegistrationEditDeps } from '../registration-update';

const BASE = { documentId: 'r1', childName: 'Maria Pop', childBirthDate: '14 martie 2016', phone: '0722', status: 'Nou', season: '2026-2027', archived: false, childHeight: 130, lastSeason: null };

function deps(row: Record<string, unknown> | null = { ...BASE }) {
  const saved: Record<string, unknown>[] = [];
  const history: HistoryInput[] = [];
  const refreshed: string[] = [];
  const logs: string[] = [];
  const d: RegistrationEditDeps = {
    find: async () => row,
    save: async (_id, data) => {
      saved.push(data);
      return { ...row, ...data };
    },
    seasonIdForLabel: async (label) => (label === '2025-2026' ? 's25' : null),
    rebuild: async (_id, data) => ('childName' in data ? { ok: true, documents: ['acord'] } : null),
    record: async (e) => {
      history.push(e);
    },
    refreshMatch: async (id) => {
      refreshed.push(id);
    },
    log: (m) => logs.push(m),
  };
  return { d, saved, history, refreshed, logs };
}

describe('PUT /api/forms/inscrieri/:documentId (spec 3.2, 3.4)', () => {
  it('refuses "Confirmat": only "Confirmă înscrierea" sets it', async () => {
    expect(await updateRegistration(deps().d, 'r1', { status: 'Confirmat' }, 'ana')).toEqual({ ok: false, status: 400, error: STATUS_ERROR });
  });

  it('saves only changed fields, writes old -> new, rebuilds, then "Document refăcut", then refreshes the match', async () => {
    const t = deps();
    const result = await updateRegistration(t.d, 'r1', { childName: 'Maria Popa', phone: '0722', childBirthDate: '14.03.2016', foo: 1 }, 'ana');
    expect(result).toMatchObject({ ok: true, changed: ['childName', 'childBirthDate'], rebuild: { ok: true } });
    expect(t.saved).toEqual([{ childName: 'Maria Popa', childBirthDate: '14.03.2016', childBirthDateParsed: '2016-03-14' }]);
    expect(t.history.map((h) => [h.action, h.changes])).toEqual([
      ['updated', { fields: { childName: { from: 'Maria Pop', to: 'Maria Popa' }, childBirthDate: { from: '14 martie 2016', to: '14.03.2016' } } }],
      ['document-rebuilt', { documents: ['acord'] }],
    ]);
    expect(t.refreshed).toEqual(['r1']);
  });

  it('"Nicio modificare.": nothing saved, nothing written', async () => {
    const t = deps();
    expect(await updateRegistration(t.d, 'r1', { phone: '0722', archived: 'false' }, 'ana')).toMatchObject({ ok: true, changed: [] });
    expect([t.saved, t.history]).toEqual([[], []]);
  });

  it('points a new season text at its Sezon', async () => {
    const t = deps();
    await updateRegistration(t.d, 'r1', { season: ' 2025-2026 ' }, 'ana');
    expect(t.saved[0]).toEqual({ season: '2025-2026', seasonRef: 's25' });
  });

  it('edits the height and the last-season answer as the form stores them', async () => {
    const t = deps();
    await updateRegistration(t.d, 'r1', { childHeight: '132', lastSeason: 'Începători' }, 'ana');
    expect(t.saved[0]).toEqual({ childHeight: 132, lastSeason: 'Începători' });
    expect(await updateRegistration(deps().d, 'r1', { childHeight: '9' }, 'ana')).toEqual({ ok: false, status: 400, error: REGISTRATION_EDIT_ERROR });
    expect(await updateRegistration(deps().d, 'r1', { lastSeason: 'Poate' }, 'ana')).toEqual({ ok: false, status: 400, error: REGISTRATION_EDIT_ERROR });
  });

  it('is a 404 for an unknown registration', async () => {
    expect(await updateRegistration(deps(null).d, 'x', { phone: '1' }, 'ana')).toMatchObject({ ok: false, status: 404 });
  });

  it('keeps a saved edit when its history fails, and logs it', async () => {
    const t = deps();
    t.d.record = async () => {
      throw new Error('db');
    };
    expect(await updateRegistration(t.d, 'r1', { phone: '0733' }, 'ana')).toMatchObject({ ok: true, changed: ['phone'] });
    expect(t.logs[0]).toContain('db');
  });
});
```

`src/club/athletes/__tests__/registration-hooks.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { beforeRegistrationDeleted } from '../registration-hooks';
import { fakeClubStore, registrationRow } from './fake-store';

describe('deleting a confirmed registration (spec 4.6, r4 e3)', () => {
  it('notes "Înscriere ștearsă" on the athlete', async () => {
    const fake = fakeClubStore({ registrations: [registrationRow({ id: 'r1', athleteId: 'a1' })] });
    await beforeRegistrationDeleted(fake.store, 'r1', 'ana@club.ro', vi.fn());
    expect(fake.state.history.map((h) => [h.subjectId, h.action, h.changes])).toEqual([['a1', 'registration-deleted', { registrationNumber: '2026-0142' }]]);
  });

  it('writes nothing for an unconfirmed one', async () => {
    const fake = fakeClubStore({ registrations: [registrationRow({ id: 'r1' })] });
    await beforeRegistrationDeleted(fake.store, 'r1', 'ana@club.ro', vi.fn());
    expect(fake.state.history).toEqual([]);
  });
});
```

`src/api/registration-submission/__tests__/edit-wiring.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const controller = readFileSync(join(__dirname, '..', 'controllers/registration-submission.ts'), 'utf8');
const method = (name: string, next: string) => controller.slice(controller.indexOf(`async ${name}(`), controller.indexOf(`async ${next}(`));

it('the PUT goes through updateRegistration', () => {
  expect(method('updateSubmission', 'deleteSubmission')).toContain('updateRegistration(registrationEditDeps(strapi)');
});

it('a delete notes it on the athlete before the row goes', () => {
  const del = method('deleteSubmission', 'archiveSeason');
  expect(del.indexOf('beforeRegistrationDeleted(')).toBeGreaterThan(-1);
  expect(del.indexOf('beforeRegistrationDeleted(')).toBeLessThan(del.indexOf('strapi.documents(UID).delete('));
  expect(method('deleteArchivedSeason', 'moveSeason')).toContain('beforeRegistrationDeleted(');
});
```

In `src/club/__tests__/registration-edit.test.ts`, the last test (`'the admin PUT accepts these fields, checks them and records the rebuild'`) reads the controller code this task moves; point it at the new module:

```ts
it('the admin PUT accepts these fields, checks them and records the rebuild', () => {
  const update = readFileSync(join(__dirname, '..', 'registration-update.ts'), 'utf8');
  expect(update).toContain('...REGISTRATION_EDIT_FIELDS,');
  expect(update).toContain('return registrationEditError(data);');
  expect(update).toContain('if (rebuild?.ok) await guarded(');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/__tests__/registration-update.test.ts src/club/__tests__/registration-edit.test.ts src/club/athletes/__tests__/registration-hooks.test.ts src/api/registration-submission/__tests__/edit-wiring.test.ts`
Expected: FAIL with "Cannot find module '../registration-update'" and the missing wiring.

- [ ] **Step 3: Write the implementation**

`src/club/registration-update.ts`:

```ts
import type { FieldChange } from './admin-result';
import { birthDateSortKey } from './birth-date';
import type { RebuildResult } from './documents';
import type { HistoryInput } from './history';
import { HISTORY_ACTIONS, SUBJECT } from './history-text';
import { REGISTRATION_EDIT_ERROR, REGISTRATION_EDIT_FIELDS, documentRebuiltEntry, normalizeRegistrationEdit, registrationEditError } from './registration-edit';
import { LAST_SEASON_OPTIONS } from './registration-form-options';
import { parseChildHeight } from './registration-input';

/**
 * PUT /api/forms/inscrieri/:documentId: the panel's "Editează" and the full table's cell edits (spec 3.2, 3.4).
 * Only changed fields are saved; each is written old -> new; the PDFs are rebuilt when a printed field changed;
 * no e-mail. "Confirmat" is set only by "Confirmă înscrierea" (spec 3.5).
 */
export const SETTABLE_STATUSES = ['Nou', 'Contactat', 'Respins'] as const;
export const STATUS_ERROR = 'Stare invalidă.';

export const EDITABLE_FIELDS: ReadonlySet<string> = new Set<string>([
  'email', 'phone', 'childName', 'childBirthDate', 'parentName', 'shirtSize', 'howHeard', 'level', 'priorExperience', 'expectations',
  'clubInterest', 'regulationsAgreement', 'privacyConsent', 'status', 'internalNote', 'archived', 'season',
  ...REGISTRATION_EDIT_FIELDS, 'childHeight', 'lastSeason',
]);
const MATCH_FIELDS = ['childName', 'childBirthDate', 'phone', 'email'];

export type RegistrationEditDeps = {
  find(id: string): Promise<Record<string, unknown> | null>;
  save(id: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  seasonIdForLabel(label: unknown): Promise<string | null>;
  rebuild(id: string, data: Record<string, unknown>): Promise<RebuildResult | null>;
  record(entry: HistoryInput): Promise<void>;
  refreshMatch(id: string): Promise<void>;
  log(message: string): void;
};
export type RegistrationEditResult =
  | { ok: true; data: Record<string, unknown>; rebuild: RebuildResult | null; changed: string[] }
  | { ok: false; status: 400 | 404; error: string };

const NOT_FOUND = { ok: false as const, status: 404 as const, error: 'not-found' };
const trimOrEmpty = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
const blankToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

export function pickEditable(raw: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!EDITABLE_FIELDS.has(key)) continue;
    if (key === 'archived') data[key] = asBool(value);
    else if (key === 'season') data[key] = trimOrEmpty(value) || null;
    else data[key] = value;
  }
  return data;
}

const validHeight = (v: unknown) => v === null || v === '' || parseChildHeight(String(v).trim()) !== null;
const validLastSeason = (v: unknown) => v === null || v === '' || (LAST_SEASON_OPTIONS as readonly unknown[]).includes(v);

export function editError(data: Record<string, unknown>): string | null {
  if ('status' in data && !(SETTABLE_STATUSES as readonly unknown[]).includes(data.status)) return STATUS_ERROR;
  if ('childHeight' in data && !validHeight(data.childHeight)) return REGISTRATION_EDIT_ERROR;
  if ('lastSeason' in data && !validLastSeason(data.lastSeason)) return REGISTRATION_EDIT_ERROR;
  return registrationEditError(data);
}

function normalizeEdit(data: Record<string, unknown>): Record<string, unknown> {
  const out = normalizeRegistrationEdit(data);
  if ('childHeight' in out) out.childHeight = out.childHeight === null || out.childHeight === '' ? null : Number(String(out.childHeight).trim());
  if ('lastSeason' in out) out.lastSeason = trimOrEmpty(out.lastSeason) || null;
  return out;
}

export function editChanges(before: Record<string, unknown>, data: Record<string, unknown>): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const [key, to] of Object.entries(data)) {
    const from = blankToNull(before[key]);
    if (from !== blankToNull(to)) out[key] = { from, to: blankToNull(to) };
  }
  return out;
}

async function withDerived(deps: RegistrationEditDeps, changes: Record<string, FieldChange>): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = Object.fromEntries(Object.entries(changes).map(([k, c]) => [k, c.to]));
  if ('season' in data) data.seasonRef = await deps.seasonIdForLabel(data.season);
  if ('childBirthDate' in data) data.childBirthDateParsed = birthDateSortKey(data.childBirthDate);
  return data;
}

async function guarded(deps: RegistrationEditDeps, what: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (err) {
    deps.log(`[inscrieri] ${what} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function saveChanges(deps: RegistrationEditDeps, id: string, changes: Record<string, FieldChange>, actor: string): Promise<RegistrationEditResult> {
  const data = await withDerived(deps, changes);
  const saved = await deps.save(id, data);
  if (!saved) return NOT_FOUND;
  await guarded(deps, `history of ${id}`, () => deps.record({ subjectType: SUBJECT.registration, subjectId: id, action: HISTORY_ACTIONS.updated, changes: { fields: changes }, actor }));
  const rebuild = await deps.rebuild(id, data);
  if (rebuild?.ok) await guarded(deps, `rebuild history of ${id}`, () => deps.record(documentRebuiltEntry(id, rebuild.documents, actor)));
  if (MATCH_FIELDS.some((k) => k in changes)) await guarded(deps, `match of ${id}`, () => deps.refreshMatch(id));
  return { ok: true, data: saved, rebuild, changed: Object.keys(changes) };
}

export async function updateRegistration(deps: RegistrationEditDeps, id: string, raw: Record<string, unknown>, actor: string): Promise<RegistrationEditResult> {
  const picked = pickEditable(raw);
  const error = editError(picked);
  if (error) return { ok: false, status: 400, error };
  const before = await deps.find(id);
  if (!before) return NOT_FOUND;
  const changes = editChanges(before, normalizeEdit(picked));
  if (Object.keys(changes).length === 0) return { ok: true, data: before, rebuild: null, changed: [] };
  return saveChanges(deps, id, changes, actor);
}
```

`src/api/registration-submission/edit-deps.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { clubStore } from '../../club/athletes/http';
import { refreshRegistrationMatch } from '../../club/athletes/matches';
import { rebuildAfterEdit, seasonIdForLabel } from '../../club/documents';
import { recordHistory } from '../../club/history';
import type { RegistrationEditDeps } from '../../club/registration-update';

const UID = 'api::registration-submission.registration-submission' as const;

/** The Strapi side of updateRegistration. */
export function registrationEditDeps(strapi: Core.Strapi): RegistrationEditDeps {
  const docs = () => strapi.documents(UID);
  return {
    find: async (id) => (await docs().findOne({ documentId: id })) as unknown as Record<string, unknown> | null,
    save: async (id, data) => (await docs().update({ documentId: id, data })) as unknown as Record<string, unknown> | null,
    seasonIdForLabel: (label) => seasonIdForLabel(strapi, label),
    rebuild: (id, data) => rebuildAfterEdit(strapi, id, data),
    record: (entry) => recordHistory(strapi, entry),
    refreshMatch: (id) => refreshRegistrationMatch(clubStore(strapi), id),
    log: (message) => strapi.log.error(message),
  };
}
```

Append to `src/club/athletes/registration-hooks.ts` (its imports already cover it):

```ts
/** A confirmed registration deleted: the athlete keeps its data, groups and A.C.S.; Istoric notes it (r4 e3). */
export async function beforeRegistrationDeleted(store: ClubStore, registrationId: string, actor: string, log: (message: string) => void): Promise<void> {
  await safely(
    async () => {
      const registration = await store.registration(registrationId);
      if (!registration?.athleteId) return;
      const changes = { registrationNumber: registration.number };
      await store.record({ subjectType: SUBJECT.athlete, subjectId: registration.athleteId, action: HISTORY_ACTIONS.registrationDeleted, changes, actor });
    },
    log,
    `history of deleting ${registrationId}`,
  );
}
```

In the controller `src/api/registration-submission/controllers/registration-submission.ts`:

1. Delete `const STATUSES = ...`, `const EDITABLE_FIELDS = ...` (lines 41-66) and `async function recordDocumentRebuilt(...)` (lines 221-230). From the `../../../club/documents` import remove `rebuildAfterEdit`, `seasonIdForLabel` and `type RebuildResult`; delete the `../../../club/history` import and the whole `../../../club/registration-edit` import. Add:

```ts
import { beforeRegistrationDeleted } from '../../../club/athletes/registration-hooks';
import { updateRegistration } from '../../../club/registration-update';
import { registrationEditDeps } from '../edit-deps';
```

2. `updateSubmission` becomes:

```ts
  /**
   * PUT /api/forms/inscrieri/:documentId  (admin-guarded)
   * Panel "Editează" and full-table cell edits: src/club/registration-update.ts. Answers { data, rebuild?, changed }.
   */
  async updateSubmission(ctx) {
    const raw = ((ctx.request.body as Record<string, unknown>)?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;
    const actor = await adminActor(ctx.request.header?.authorization, strapi);
    const result = await updateRegistration(registrationEditDeps(strapi), ctx.params.documentId, raw, actor);
    if (result.ok === false) return result.status === 404 ? ctx.notFound() : ctx.badRequest(result.error);
    ctx.body = result.rebuild ? { data: result.data, rebuild: result.rebuild, changed: result.changed } : { data: result.data, changed: result.changed };
  },
```

3. `deleteSubmission` becomes:

```ts
  async deleteSubmission(ctx) {
    const { documentId } = ctx.params;
    const actor = await adminActor(ctx.request.header?.authorization, strapi);
    await beforeRegistrationDeleted(clubStore(strapi), documentId, actor, (m) => strapi.log.error(m));
    await deleteRegistrationEmailJobs(strapi, [documentId]);
    await strapi.documents(UID).delete({ documentId });
    await removeDocuments(documentId);
    ctx.body = { data: { documentId } };
  },
```

4. In `deleteArchivedSeason`, before the `deleteRegistrationsWithDocuments` call add `const actor = await adminActor(ctx.request.header?.authorization, strapi);` and change `findIds` to note each confirmed registration on its athlete:

```ts
      findIds: async () => {
        const rows = (await strapi.db.query(UID).findMany({ select: ['documentId'], where: { season, archived: true } })) as { documentId?: unknown }[];
        const ids = rows.map((r) => r.documentId).filter((id): id is string => typeof id === 'string');
        for (const id of ids) await beforeRegistrationDeleted(clubStore(strapi), id, actor, (m) => strapi.log.error(m));
        return ids;
      },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club src/api/registration-submission && npx tsc --noEmit`
Expected: PASS (the existing `delete-wiring.test.ts` too), zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/registration-update.ts src/club/__tests__/registration-update.test.ts src/club/__tests__/registration-edit.test.ts src/club/athletes/registration-hooks.ts src/club/athletes/__tests__/registration-hooks.test.ts src/api/registration-submission
git commit -m "feat(inscrieri): registration edits write old -> new to Istoric; Confirmat only by confirming"
```

---

### Task 15: Înscrieri list: Vârstă, "Sportiv existent", school tabs

**Files:**
- Create: `src/club/registration-list.ts`
- Modify: `src/api/registration-submission/list-search.ts` (add `listSort`, `existingClause`, `schoolClause`)
- Modify: `src/api/registration-submission/controllers/registration-submission.ts` (`buildListFilters`, `list`, `fetchFiltered`; delete `buildSort`)
- Test: `src/club/__tests__/registration-list.test.ts`, `src/api/registration-submission/__tests__/list-search.test.ts` (append)

**Interfaces:**
- Consumes: `ageFromText`, `todayInBucharest`, `DateParts` (Task 2).
- Produces:
  - `listSort(v: unknown): Record<string, 'asc' | 'desc'>` (`newest` default, `oldest`, `name`, `age-asc`, `age-desc`), `existingClause(v: unknown)`, `schoolClause(v: unknown)`
  - `type RegistrationListExtras = { age: number | null; existingAthlete: boolean; athleteId: string | null; athleteName: string | null; canUndo: boolean; schoolId: string | null; schoolName: string | null }`
  - `listRowExtras(row, today)`, `publicListRow(row, today)` (drops `confirmation`, `matchAthlete`, `matchLevel`, `submissionKey`, `athlete`, `section`, `childBirthDateParsed`), `registrationSchools(sections)`
  - GET `/api/forms/inscrieri` takes `existing=da|nu`, `school=<section documentId>`, `sort=age-asc|age-desc` and answers, besides today's keys, `schools: { documentId, name, count }[]`, `multipleSchools: boolean`, `allSchoolsTotal: number`; every row carries the extras above.

- [ ] **Step 1: Write the failing tests**

In `src/api/registration-submission/__tests__/list-search.test.ts`, change the import to `import { existingClause, listSort, quickSearchClause, schoolClause } from '../list-search';` and append:

```ts
describe('Înscrieri list, phase 3', () => {
  it('sorts by age through the parsed birth date (younger = later date)', () => {
    expect(listSort('age-asc')).toEqual({ childBirthDateParsed: 'desc' });
    expect(listSort('age-desc')).toEqual({ childBirthDateParsed: 'asc' });
    expect(listSort('name')).toEqual({ childName: 'asc' });
    expect(listSort('x')).toEqual({ submittedAt: 'desc' });
  });

  it('"Sportiv existent: Da / Nu" counts only registrations with no athlete linked (gaps #16)', () => {
    expect(existingClause('da')).toEqual({ athlete: { id: { $null: true } }, matchLevel: { $notNull: true } });
    expect(existingClause('nu')).toEqual({ $or: [{ athlete: { id: { $notNull: true } } }, { matchLevel: { $null: true } }] });
    expect(existingClause('')).toBeNull();
  });

  it('filters one school', () => {
    expect(schoolClause(' afi ')).toEqual({ section: { documentId: 'afi' } });
    expect(schoolClause(undefined)).toBeNull();
  });
});
```

`src/club/__tests__/registration-list.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { listRowExtras, publicListRow, registrationSchools } from '../registration-list';

const TODAY = { year: 2026, month: 10, day: 26 };

describe('list row extras (spec 3.1)', () => {
  it('age today, the "Sportiv existent" line only while unconfirmed', () => {
    expect(listRowExtras({ childBirthDate: '14.03.2016', matchLevel: 'probabil', athlete: null }, TODAY)).toMatchObject({ age: 10, existingAthlete: true, athleteId: null, canUndo: false });
    expect(listRowExtras({ childBirthDate: 'ieri', matchLevel: 'sigur', athlete: { documentId: 'a1', name: 'Maria' } }, TODAY)).toMatchObject({ age: null, existingAthlete: false, athleteId: 'a1', athleteName: 'Maria' });
  });

  it('offers the undo only when the confirmation record names the linked athlete', () => {
    expect(listRowExtras({ athlete: { documentId: 'a1' }, confirmation: { athleteId: 'a1' } }, TODAY).canUndo).toBe(true);
    expect(listRowExtras({ athlete: { documentId: 'a1' }, confirmation: null }, TODAY).canUndo).toBe(false);
  });

  it('never sends the internal fields', () => {
    const row = publicListRow({ documentId: 'r1', childName: 'Maria', confirmation: { athleteId: 'a1' }, matchAthlete: { documentId: 'a1' }, matchLevel: 'sigur', submissionKey: 'k', section: { documentId: 'afi', name: 'AFI' }, childBirthDateParsed: '2016-03-14' }, TODAY);
    expect(Object.keys(row).sort()).toEqual(['age', 'athleteId', 'athleteName', 'canUndo', 'childName', 'documentId', 'existingAthlete', 'schoolId', 'schoolName']);
    expect(row.schoolName).toBe('AFI');
  });
});

describe('school tabs (spec 3.6)', () => {
  it('lists the schools with a public page, Club never', () => {
    expect(registrationSchools([
      { documentId: 'club', name: 'Club', kind: 'club', publicPage: true, order: 0 },
      { documentId: 'p2', name: 'Patinoar 2', kind: 'school', publicPage: true, order: 2 },
      { documentId: 'afi', name: 'AFI', kind: 'school', publicPage: true, order: 1 },
      { documentId: 'old', name: 'Veche', kind: 'school', publicPage: false, order: 3 },
    ])).toEqual([{ documentId: 'afi', name: 'AFI' }, { documentId: 'p2', name: 'Patinoar 2' }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/__tests__/registration-list.test.ts src/api/registration-submission/__tests__/list-search.test.ts`
Expected: FAIL ("Cannot find module '../registration-list'", `listSort` not exported).

- [ ] **Step 3: Write the implementation**

Append to `src/api/registration-submission/list-search.ts`:

```ts
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** "Vârstă" sorts on the parsed birth date (age ascending = birth date descending); unreadable dates have none. */
export function listSort(v: unknown): Record<string, 'asc' | 'desc'> {
  switch (text(v)) {
    case 'oldest':
      return { submittedAt: 'asc' };
    case 'name':
      return { childName: 'asc' };
    case 'age-asc':
      return { childBirthDateParsed: 'desc' };
    case 'age-desc':
      return { childBirthDateParsed: 'asc' };
    default:
      return { submittedAt: 'desc' };
  }
}

/** "Sportiv existent: Da / Nu" (spec 3.1): a saved match on a registration with no athlete linked. */
export function existingClause(v: unknown): Record<string, unknown> | null {
  if (text(v) === 'da') return { athlete: { id: { $null: true } }, matchLevel: { $notNull: true } };
  if (text(v) === 'nu') return { $or: [{ athlete: { id: { $notNull: true } } }, { matchLevel: { $null: true } }] };
  return null;
}

export function schoolClause(v: unknown): Record<string, unknown> | null {
  return text(v) ? { section: { documentId: text(v) } } : null;
}
```

`src/club/registration-list.ts`:

```ts
import { ageFromText, type DateParts } from './birth-date';

/** What the Înscrieri list adds to each registration row (spec 3.1, 3.6), and what it never sends. */
export type RegistrationListExtras = {
  age: number | null;
  existingAthlete: boolean;
  athleteId: string | null;
  athleteName: string | null;
  canUndo: boolean;
  schoolId: string | null;
  schoolName: string | null;
};

const HIDDEN = ['confirmation', 'matchAthlete', 'matchLevel', 'submissionKey', 'athlete', 'section', 'childBirthDateParsed'] as const;

const rel = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);
const relText = (v: unknown, key: string): string | null => {
  const value = rel(v)?.[key];
  return typeof value === 'string' && value ? value : null;
};

export function listRowExtras(row: Record<string, unknown>, today: DateParts): RegistrationListExtras {
  const athleteId = relText(row.athlete, 'documentId');
  return {
    age: ageFromText(row.childBirthDate, today),
    existingAthlete: athleteId === null && (row.matchLevel === 'sigur' || row.matchLevel === 'probabil'),
    athleteId,
    athleteName: relText(row.athlete, 'name'),
    canUndo: athleteId !== null && relText(row.confirmation, 'athleteId') === athleteId,
    schoolId: relText(row.section, 'documentId'),
    schoolName: relText(row.section, 'name'),
  };
}

export function publicListRow(row: Record<string, unknown>, today: DateParts): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const key of HIDDEN) delete out[key];
  return { ...out, ...listRowExtras(row, today) };
}

type SectionLike = { documentId?: unknown; name?: unknown; kind?: unknown; publicPage?: unknown; order?: unknown };

/** Registration schools: sections of kind school with a public page (spec 3.6), in their order. */
export function registrationSchools(sections: SectionLike[]): { documentId: string; name: string }[] {
  return sections
    .filter((s) => s.kind === 'school' && s.publicPage === true && typeof s.documentId === 'string')
    .sort((a, b) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999))
    .map((s) => ({ documentId: String(s.documentId), name: typeof s.name === 'string' ? s.name : '' }));
}
```

In the controller:

1. Imports: change `import { quickSearchClause } from '../list-search';` to

```ts
import { existingClause, listSort, quickSearchClause, schoolClause } from '../list-search';
import { todayInBucharest } from '../../../club/birth-date';
import { publicListRow, registrationSchools } from '../../../club/registration-list';
```

2. Delete `function buildSort(...)` and replace its two callers (`fetchFiltered` and `list`) with `listSort(query.sort)`.

3. Before `buildListFilters`, add:

```ts
/** The phase 3 filters: "Sportiv existent" and the school tab. */
function phase3Clauses(query: Record<string, unknown>): Record<string, unknown>[] {
  return [existingClause(query.existing), schoolClause(query.school)].filter((c): c is Record<string, unknown> => c !== null);
}
```

and in `buildListFilters`, right after the quick-search block, add `and.push(...phase3Clauses(query));`.

4. Add, before the `export default`:

```ts
/** Tabs "Toate (n)", "<școală> (n)" (spec 3.6): counts under the current filters, without the school filter. */
async function schoolTabsFor(query: Record<string, unknown>, activeSeason: string | null) {
  const schools = registrationSchools((await strapi.documents('api::section.section').findMany({ limit: 100 })) as unknown as Record<string, unknown>[]);
  const base = buildListFilters({ ...query, school: '' }, activeSeason);
  const count = (filters: Record<string, unknown>) => strapi.documents(UID).count({ filters });
  const counts = await Promise.all(schools.map((s) => count({ $and: [base, { section: { documentId: s.documentId } }] })));
  return { schools: schools.map((s, i) => ({ ...s, count: counts[i] })), multipleSchools: schools.length >= 2, allSchoolsTotal: await count(base) };
}
```

5. In `list`, fetch the page with the athlete and school populated (inline literal, as `src/club/public-info-loader.ts` does), the tabs beside it, and map the rows:

```ts
    const [data, total, tabs] = await Promise.all([
      strapi.documents(UID).findMany({
        filters, sort, start, limit: pageSize,
        populate: { athlete: { fields: ['documentId', 'name'] }, section: { fields: ['documentId', 'name'] } },
      }),
      strapi.documents(UID).count({ filters }),
      schoolTabsFor(query, activeSeason),
    ]);
```

and in its `ctx.body`, replace `data,` with `data: data.map((row) => publicListRow(row as unknown as Record<string, unknown>, today)),` (with `const today = todayInBucharest();` before the `Promise.all`) and add `...tabs,` after `formMeta,`. Update the method's doc comment: query params `existing` (`da` | `nu`), `school` (section documentId), `sort` adds `age-asc` | `age-desc`; the answer adds `schools`, `multipleSchools`, `allSchoolsTotal`. If the method grows past 30 lines, move the `formMeta` block into `async function loadFormMeta(): Promise<Record<string, unknown>>` next to `collectExtraKeys`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club src/api/registration-submission && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/registration-list.ts src/club/__tests__/registration-list.test.ts src/api/registration-submission
git commit -m "feat(inscrieri): list age, Sportiv existent filter and line, school tabs"
```

---

### Task 16: Match card, confirm window context and athlete search

**Files:**
- Create: `src/club/athletes/search.ts`, `src/club/athletes/cards.ts`, `src/club/athletes/confirm-read.ts`
- Modify: `src/api/club/controllers/registrations.ts` (`match`, `confirmContext`), `src/api/club/controllers/athletes.ts` (`search`), `src/api/club/routes/04-registrations.ts`, `src/api/club/routes/05-athletes.ts`
- Test: `src/club/athletes/__tests__/search.test.ts`, `src/club/athletes/__tests__/confirm-read.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 7 and 11 to 13 (`rankCandidates`, `registrationFacts`, `athleteFacts`, `comparisonRows`, `defaultUpdateFields`, `registrationValues`, `registrationSeason`, `seasonRunning`, `seasonEndedText`, `canConfirm`, `canUndo`, `ACS_RANK`, `birthDateForPicker`, `pickAthleteValues`, `parseBirthDate`, `roDate`, `LAST_SEASON_OPTIONS`, `HISTORY_ACTIONS`, `normalizeSeasonLabel`).
- Produces:
  - `type SearchSubject = { names: (string | null)[]; phone: string | null; texts: (string | null)[]; birthDate: string | null }`; `matchesQuery(subject: SearchSubject, raw: string): boolean`; `searchSubjects(athletes: AthleteRow[], registrations: RegistrationRow[]): Map<string, SearchSubject>`
  - `cardMaker(store: ClubStore): Promise<(a: AthleteRow) => AthleteCard>`; `groupOptions(sectionId: string | null, sections: SectionRow[], groups: GroupRow[]): GroupSection[]`; `registrationSeasonLabel(r: RegistrationRow, seasons: SeasonRow[]): string | null`
  - `registrationMatchView(store, id): Promise<AdminResult<RegistrationMatchView>>`; `confirmContext(store, registrationId, athleteId: string | null, today): Promise<AdminResult<ConfirmContext>>`; `searchAthletes(store, query: string, registrationId: string | null): Promise<AthleteCard[]>` (at most 20)
  - Routes `GET /api/club/registrations/:documentId/match`, `GET /api/club/registrations/:documentId/confirm-context?athlete=`, `GET /api/club/athletes/search?q=&registration=`.

- [ ] **Step 1: Write the failing tests**

`src/club/athletes/__tests__/search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchesQuery, type SearchSubject } from '../search';

const subject: SearchSubject = {
  names: ['Maria Dumitrescu', 'Ana Dumitrescu', 'Ion Dumitrescu'],
  phone: '0722 111 222',
  texts: ['ana@example.com', '2026-0142'],
  birthDate: '2016-03-14',
};

describe('search (spec 5, 4.1: diacritics, word order and one typo ignored, server side)', () => {
  it.each(['', 'maria', 'Dumitresu Maria', 'dum mar', 'ion', '0722111', '+40722111222', 'ANA@EX', '2026-0142', '14.03.2016'])('finds "%s"', (q) =>
    expect(matchesQuery(subject, q)).toBe(true),
  );

  it.each(['ioana', 'xy', '0733', '15.03.2016', 'mar ioan'])('does not find "%s"', (q) => expect(matchesQuery(subject, q)).toBe(false));
});
```

`src/club/athletes/__tests__/confirm-read.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupOptions } from '../cards';
import { confirmContext, registrationMatchView, searchAthletes } from '../confirm-read';
import { athleteRow, fakeClubStore, GROUPS, registrationRow, SECTIONS } from './fake-store';

const TODAY = { year: 2026, month: 10, day: 26 };
const sigur = athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0711', updatedAt: '2026-01-01T00:00:00.000Z' });
const probabil = athleteRow({ id: 'a2', name: 'Pop Maria', birthDate: null, updatedAt: '2026-09-01T00:00:00.000Z' });
const seed = () => ({
  athletes: [sigur, probabil, athleteRow({ id: 'a3', name: 'Ion Ilie', birthDate: '2014-01-01' })],
  registrations: [registrationRow({ id: 'r1', lastSeason: 'Nu a participat' }), registrationRow({ id: 'r0', athleteId: 'a3', seasonId: 's25', season: '2025-2026' })],
  memberships: [{ id: 'm1', athleteId: 'a1', groupId: 'g-ib', seasonId: 's25', isMain: true, from: '2025-10-01' }],
});

describe('match card and window start (spec 3.3, 4.1)', () => {
  it('proposes the Sigur athlete, preselects it, lists the others', async () => {
    const view = await registrationMatchView(fakeClubStore(seed()).store, 'r1');
    expect(view.ok && view.data).toMatchObject({
      confirmed: false, canConfirm: true, canUndo: false, birthDateReadable: true, notAttendedLastSeason: true, preselect: 'existing',
      existing: { documentId: 'a1', name: 'Maria Pop', birthDate: '14.03.2016', lastGroup: { name: 'Intermediari Bronze', season: '2025-2026' } },
    });
    expect(view.ok && view.data.candidates.map((c) => c.documentId)).toEqual(['a2']);
    expect(view.ok && view.data.comparison.find((r) => r.field === 'phone')).toMatchObject({ differs: true, defaultUpdate: true });
  });

  it('a Probabil match is never preselected (r3 c1)', async () => {
    const fake = fakeClubStore({ ...seed(), athletes: [probabil] });
    const view = await registrationMatchView(fake.store, 'r1');
    expect(view.ok && [view.data.existing?.documentId, view.data.preselect]).toEqual(['a2', null]);
  });

  it('a confirmed registration shows no card', async () => {
    const view = await registrationMatchView(fakeClubStore(seed()).store, 'r0');
    expect(view.ok && [view.data.confirmed, view.data.existing, view.data.athleteId]).toEqual([true, null, 'a3']);
  });

  it('is a 404 for an unknown registration', async () => {
    expect(await registrationMatchView(fakeClubStore().store, 'x')).toMatchObject({ ok: false, status: 404 });
  });
});

describe('confirm window context (spec 4.3, 4.4)', () => {
  it('groups of the school then Club, current main group, A.C.S. change, wish, intent', async () => {
    const fake = fakeClubStore({
      ...seed(),
      registrations: [registrationRow({ id: 'r1', subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 770 } })],
      memberships: [{ id: 'm2', athleteId: 'a1', groupId: 'g-pro', seasonId: 's26', isMain: true, from: '2026-10-01' }],
    });
    const result = await confirmContext(fake.store, 'r1', 'a1', TODAY);
    expect(result.ok && result.data).toMatchObject({
      registrationNumber: '2026-0142',
      newAthlete: { name: 'Maria Pop', birthDate: '14.03.2016' },
      season: { label: '2026-2027', running: true, endedText: null },
      mainGroupNow: { name: 'Profesioniști', sectionName: 'Club' },
      acs: { seasonLabel: '2026-2027', current: null, next: 'in_asteptare', wish: 'da' },
      subscriptionIntent: 'Abonament 8 ședințe grup',
      blocked: null,
    });
    expect(result.ok && result.data.groups.map((g) => [g.sectionName, g.groups.map((x) => x.name)])).toEqual([
      ['Școala de Patinaj - AFI Cotroceni', ['Primii Pași', 'Intermediari Bronze']],
      ['Club', ['Profesioniști']],
    ]);
  });

  it('season ended: the line, no A.C.S. change', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1', seasonId: 's25', season: '2025-2026' })] });
    const result = await confirmContext(fake.store, 'r1', null, TODAY);
    expect(result.ok && result.data.season).toEqual({ label: '2025-2026', running: false, endedText: 'Sezonul 2025-2026 s-a încheiat. Se leagă doar fișa sportivului.' });
    expect(result.ok && result.data.acs.next).toBeNull();
  });

  it('blocks an unreadable birth date, Respins and a confirmed registration', async () => {
    const regs = [registrationRow({ id: 'u', childBirthDate: 'martie' }), registrationRow({ id: 'x', status: 'Respins' }), registrationRow({ id: 'c', athleteId: 'a3' })];
    const store = fakeClubStore({ ...seed(), registrations: regs }).store;
    const blocked = await Promise.all(['u', 'x', 'c'].map(async (id) => ((await confirmContext(store, id, null, TODAY)) as { data: { blocked: string } }).data.blocked));
    expect(blocked).toEqual(['birth-date', 'not-confirmable', 'confirmed']);
  });

  it('lists only active groups, school first', () => {
    const groups = [...GROUPS, { id: 'old', name: 'Veche', sectionId: 'afi', order: 0, active: false }];
    expect(groupOptions('afi', SECTIONS, groups).map((s) => s.sectionId)).toEqual(['afi', 'club']);
    expect(groupOptions(null, SECTIONS, groups).map((s) => s.sectionId)).toEqual(['club']);
  });
});

describe('Caută alt sportiv / Adaugă sportiv search (spec 4.1, 6.7)', () => {
  it('without text: the proposed athlete first, then the other candidates', async () => {
    const cards = await searchAthletes(fakeClubStore(seed()).store, '', 'r1');
    expect(cards.map((c) => c.documentId)).toEqual(['a1', 'a2']);
  });

  it('with text: matching athletes, candidates first, inactive included', async () => {
    const fake = fakeClubStore({ ...seed(), athletes: [...seed().athletes, athleteRow({ id: 'a4', name: 'Maria Ionescu', status: 'inactiv' })] });
    expect((await searchAthletes(fake.store, 'maria', 'r1')).map((c) => c.documentId)).toEqual(['a1', 'a2', 'a4']);
    expect((await searchAthletes(fake.store, 'maria', null)).map((c) => c.documentId)).toEqual(['a4', 'a1', 'a2']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/athletes/__tests__/search.test.ts src/club/athletes/__tests__/confirm-read.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the implementation**

`src/club/athletes/search.ts`:

```ts
import { isoDate, parseBirthDate } from '../birth-date';
import { nameWords, normalizePhone, withinOneEdit } from '../person-match';
import type { AthleteRow, RegistrationRow } from './store';

/**
 * Athlete search (spec 5 and 4.1): name and parent words in any order, without diacritics, a word may be typed
 * partly or with one wrong letter; phone digits; e-mail and registration number as text; a readable birth date.
 */
export type SearchSubject = { names: (string | null)[]; phone: string | null; texts: (string | null)[]; birthDate: string | null };

const wordHit = (q: string, word: string) => word.startsWith(q) || (q.length >= 4 && withinOneEdit(q, word));

function namesHit(query: string, names: (string | null)[]): boolean {
  const words = nameWords(query);
  if (words.length === 0) return false;
  return names.some((name) => {
    const own = nameWords(name);
    return words.every((q) => own.some((w) => wordHit(q, w)));
  });
}

function phoneHit(query: string, phone: string | null): boolean {
  if (!/^[\d\s+().-]+$/.test(query)) return false;
  const digits = normalizePhone(query);
  return digits.length >= 3 && normalizePhone(phone).includes(digits);
}

function textHit(query: string, texts: (string | null)[]): boolean {
  const q = query.toLowerCase();
  return q.length >= 3 && texts.some((t) => (t ?? '').toLowerCase().includes(q));
}

function dateHit(query: string, birthDate: string | null): boolean {
  const parts = parseBirthDate(query);
  return parts !== null && isoDate(parts) === birthDate;
}

export function matchesQuery(subject: SearchSubject, raw: string): boolean {
  const query = raw.trim();
  if (!query) return true;
  return namesHit(query, subject.names) || phoneHit(query, subject.phone) || textHit(query, subject.texts) || dateHit(query, subject.birthDate);
}

/** Per athlete: its name and contact, plus the parents and numbers of its linked registrations. */
export function searchSubjects(athletes: AthleteRow[], registrations: RegistrationRow[]): Map<string, SearchSubject> {
  const linked = new Map<string, RegistrationRow[]>();
  for (const r of registrations) if (r.athleteId) linked.set(r.athleteId, [...(linked.get(r.athleteId) ?? []), r]);
  return new Map(athletes.map((a) => {
    const regs = linked.get(a.id) ?? [];
    return [a.id, { names: [a.name, a.contactName, ...regs.map((r) => r.parentName)], phone: a.phone, texts: [a.email, ...regs.map((r) => r.number)], birthDate: a.birthDate }];
  }));
}
```

`src/club/athletes/cards.ts`:

```ts
import { birthDateForPicker } from '../athlete-data';
import { HISTORY_ACTIONS } from '../history-text';
import { normalizeSeasonLabel } from '../season';
import type { AthleteCard, GroupSection } from './api-types';
import type { AthleteRow, ClubStore, GroupRow, HistoryRow, MembershipRow, RegistrationRow, SeasonRow, SectionRow } from './store';

/** The season label of a registration: its Sezon link, else its season text. */
export function registrationSeasonLabel(r: RegistrationRow, seasons: SeasonRow[]): string | null {
  return seasons.find((s) => s.id === r.seasonId)?.label ?? normalizeSeasonLabel(r.season);
}

function lastGroup(own: MembershipRow[], groups: Map<string, string>, seasons: Map<string, string>): AthleteCard['lastGroup'] {
  const dated = own.map((m) => ({ m, season: seasons.get(m.seasonId) ?? '' })).sort((a, b) => b.season.localeCompare(a.season) || Number(b.m.isMain) - Number(a.m.isMain));
  const top = dated[0];
  return top ? { name: groups.get(top.m.groupId) ?? '', season: top.season } : null;
}

/** "Ultima înscriere: <sezon>" (gaps #5): linked registrations, and those an athlete was made from at deploy. */
function pastSeasons(entries: HistoryRow[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of entries) {
    const regs = Array.isArray(e.changes.registrations) ? (e.changes.registrations as { season?: unknown }[]) : [];
    out.set(e.subjectId, regs.map((r) => (typeof r.season === 'string' ? r.season : '')).filter(Boolean));
  }
  return out;
}

const newest = (labels: (string | null)[]): string | null => labels.filter((l): l is string => !!l).sort().pop() ?? null;

export async function cardMaker(store: ClubStore): Promise<(a: AthleteRow) => AthleteCard> {
  const [memberships, groups, seasons, registrations, made] = await Promise.all([
    store.memberships(), store.groups(), store.seasons(), store.registrations(), store.historyByAction(HISTORY_ACTIONS.createdFromRegistrations),
  ]);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const seasonLabel = new Map(seasons.map((s) => [s.id, s.label]));
  const past = pastSeasons(made);
  return (a) => ({
    documentId: a.id,
    name: a.name ?? '',
    birthDate: birthDateForPicker(a.birthDate),
    lastGroup: lastGroup(memberships.filter((m) => m.athleteId === a.id), groupName, seasonLabel),
    lastRegistrationSeason: newest([...registrations.filter((r) => r.athleteId === a.id).map((r) => registrationSeasonLabel(r, seasons)), ...(past.get(a.id) ?? [])]),
    contactName: a.contactName,
    status: a.status,
  });
}

const byOrder = <T extends { order: number | null; name: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'ro'));

/** Group picker (spec 4.3, gaps #28): the registration's school, then Club; active groups in their own order. */
export function groupOptions(sectionId: string | null, sections: SectionRow[], groups: GroupRow[]): GroupSection[] {
  const school = sections.filter((s) => s.id === sectionId && s.kind === 'school');
  const clubs = byOrder(sections.filter((s) => s.kind === 'club'));
  return [...school, ...clubs]
    .map((s) => ({ sectionId: s.id, sectionName: s.name, groups: byOrder(groups.filter((g) => g.sectionId === s.id && g.active)).map((g) => ({ documentId: g.id, name: g.name })) }))
    .filter((s) => s.groups.length > 0);
}
```

`src/club/athletes/confirm-read.ts`:

```ts
import { ACS_RANK, type AcsState } from '../acs';
import { refuse, type AdminResult } from '../admin-result';
import { pickAthleteValues } from '../athlete-data';
import { parseBirthDate, roDate, type DateParts } from '../birth-date';
import { comparisonRows, defaultUpdateFields, registrationValues } from '../confirm/compare';
import { canConfirm, canUndo } from '../confirm/plan';
import { registrationSeason, seasonEndedText, seasonRunning, type SeasonFacts } from '../confirm/season';
import { matchesQuery, searchSubjects } from './search';
import { rankCandidates, registrationFacts, type Candidate } from '../matching';
import { LAST_SEASON_OPTIONS } from '../registration-form-options';
import type { AthleteCard, ConfirmContext, RegistrationMatchView } from './api-types';
import { cardMaker, groupOptions } from './cards';
import { ADMIN_ERRORS } from './errors';
import { athleteFacts } from './matches';
import type { AthleteRow, ClubStore, GroupRow, RegistrationRow, SectionRow } from './store';

const SEARCH_LIMIT = 20;

function candidatesFor(reg: RegistrationRow, athletes: AthleteRow[]): Candidate[] {
  return reg.athleteId ? [] : rankCandidates(registrationFacts(reg), athletes.map(athleteFacts));
}

function matchView(reg: RegistrationRow, ranked: Candidate[], byId: Map<string, AthleteRow>, card: (a: AthleteRow) => AthleteCard): RegistrationMatchView {
  const proposed = ranked[0] ? byId.get(ranked[0].athleteId) ?? null : null;
  const others = ranked.slice(1).flatMap((c) => byId.get(c.athleteId) ?? []);
  return {
    confirmed: reg.athleteId !== null,
    athleteId: reg.athleteId,
    canConfirm: canConfirm(reg),
    canUndo: canUndo(reg),
    birthDateReadable: parseBirthDate(reg.childBirthDate) !== null,
    notAttendedLastSeason: reg.lastSeason === LAST_SEASON_OPTIONS[0],
    existing: proposed ? card(proposed) : null,
    preselect: ranked[0]?.level === 'sigur' ? 'existing' : null,
    comparison: proposed ? comparisonRows(pickAthleteValues(proposed), reg) : [],
    candidates: others.map(card),
  };
}

/** GET /api/club/registrations/:documentId/match: the panel card (only while unconfirmed) and the window's start. */
export async function registrationMatchView(store: ClubStore, id: string): Promise<AdminResult<RegistrationMatchView>> {
  const reg = await store.registration(id);
  if (!reg) return refuse(404, ADMIN_ERRORS.notFound);
  const athletes = await store.athletes();
  const card = await cardMaker(store);
  return { ok: true, data: matchView(reg, candidatesFor(reg, athletes), new Map(athletes.map((a) => [a.id, a])), card) };
}

type SeasonState = { mainGroupNow: ConfirmContext['mainGroupNow']; current: AcsState | null };

async function athleteSeasonState(store: ClubStore, athleteId: string, season: SeasonFacts, groups: GroupRow[], sections: SectionRow[]): Promise<SeasonState> {
  const [memberships, acs] = await Promise.all([store.memberships(athleteId), store.acsRows(athleteId)]);
  const main = memberships.find((m) => m.seasonId === season.id && m.isMain);
  const group = main ? groups.find((g) => g.id === main.groupId) : undefined;
  const sectionName = sections.find((s) => s.id === group?.sectionId)?.name ?? '';
  return { mainGroupNow: group ? { name: group.name, sectionName } : null, current: acs.find((r) => r.seasonId === season.id)?.state ?? null };
}

function nextAcs(reg: RegistrationRow, running: boolean, current: AcsState | null): AcsState | null {
  if (!running || reg.membershipAnswer !== 'da') return null;
  return current !== null && ACS_RANK[current] >= ACS_RANK.in_asteptare ? null : 'in_asteptare';
}

function blockedOf(reg: RegistrationRow): ConfirmContext['blocked'] {
  if (reg.athleteId) return 'confirmed';
  if (!canConfirm(reg)) return 'not-confirmable';
  return parseBirthDate(reg.childBirthDate) ? null : 'birth-date';
}

const intentOf = (choice: unknown): string | null => {
  const name = choice && typeof choice === 'object' ? (choice as { priceItemName?: unknown }).priceItemName : null;
  return typeof name === 'string' && name ? name : null;
};

function buildContext(reg: RegistrationRow, season: SeasonFacts | null, running: boolean, state: SeasonState, athlete: AthleteRow | null): Omit<ConfirmContext, 'groups'> {
  const birth = parseBirthDate(reg.childBirthDate);
  const rows = athlete ? comparisonRows(pickAthleteValues(athlete), reg) : [];
  return {
    registrationNumber: reg.number,
    newAthlete: { name: registrationValues(reg).name ?? '', birthDate: birth ? roDate(birth) : null },
    season: { label: season?.label ?? null, running, endedText: season && !running ? seasonEndedText(season.label) : null },
    mainGroupNow: state.mainGroupNow,
    acs: { seasonLabel: season?.label ?? null, current: state.current, next: nextAcs(reg, running, state.current), wish: reg.membershipAnswer },
    subscriptionIntent: intentOf(reg.subscriptionChoice),
    comparison: rows,
    defaultUpdateFields: defaultUpdateFields(rows),
    blocked: blockedOf(reg),
  };
}

const NO_STATE: SeasonState = { mainGroupNow: null, current: null };

/** GET /api/club/registrations/:documentId/confirm-context?athlete=<documentId>: what the window shows for one choice. */
export async function confirmContext(store: ClubStore, registrationId: string, athleteId: string | null, today: DateParts): Promise<AdminResult<ConfirmContext>> {
  const reg = await store.registration(registrationId);
  const athlete = athleteId ? await store.athlete(athleteId) : null;
  if (!reg || (athleteId && !athlete)) return refuse(404, ADMIN_ERRORS.notFound);
  const [seasons, sections, groups] = await Promise.all([store.seasons(), store.sections(), store.groups()]);
  const season = registrationSeason(reg, seasons);
  const running = seasonRunning(season, today);
  const state = athlete && season && running ? await athleteSeasonState(store, athlete.id, season, groups, sections) : NO_STATE;
  return { ok: true, data: { ...buildContext(reg, season, running, state, athlete), groups: groupOptions(reg.sectionId, sections, groups) } };
}

const rankedFirst = (ranked: string[]) => (a: AthleteRow, b: AthleteRow) => {
  const ia = ranked.indexOf(a.id);
  const ib = ranked.indexOf(b.id);
  return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib) || (a.name ?? '').localeCompare(b.name ?? '', 'ro');
};

/** "Caută alt sportiv" and "Adaugă sportiv" (spec 4.1, 6.7, P13). Without text: the registration's candidates. */
export async function searchAthletes(store: ClubStore, query: string, registrationId: string | null): Promise<AthleteCard[]> {
  const [athletes, registrations, card] = await Promise.all([store.athletes(), store.registrations(), cardMaker(store)]);
  const reg = registrationId ? registrations.find((r) => r.id === registrationId) ?? null : null;
  const ranked = reg ? candidatesFor(reg, athletes).map((c) => c.athleteId) : [];
  const subjects = searchSubjects(athletes, registrations);
  const hits = athletes.filter((a) => {
    const subject = subjects.get(a.id);
    return query.trim() ? subject !== undefined && matchesQuery(subject, query) : ranked.includes(a.id);
  });
  return hits.sort(rankedFirst(ranked)).slice(0, SEARCH_LIMIT).map(card);
}
```

In `src/api/club/controllers/registrations.ts` add the imports and handlers:

```ts
import { respond } from '../../../club/admin-http';
import { confirmContext, registrationMatchView } from '../../../club/athletes/confirm-read';
import { queryText } from '../../../club/athletes/http';
import { todayInBucharest } from '../../../club/birth-date';
```

```ts
  async match(ctx: AdminCtx) {
    respond(ctx, await registrationMatchView(clubStore(strapi), ctx.params.documentId ?? ''));
  },

  async confirmContext(ctx: AdminCtx) {
    const athlete = queryText(ctx.query.athlete) || null;
    respond(ctx, await confirmContext(clubStore(strapi), ctx.params.documentId ?? '', athlete, todayInBucharest()));
  },
```

In `src/api/club/controllers/athletes.ts` add the import `import { searchAthletes } from '../../../club/athletes/confirm-read';` and `queryText` to the `http` import, and the handler:

```ts
  async search(ctx: AdminCtx) {
    ctx.body = { data: await searchAthletes(clubStore(strapi), queryText(ctx.query.q), queryText(ctx.query.registration) || null) };
  },
```

Routes: in `04-registrations.ts` append

```ts
    { method: 'GET', path: '/club/registrations/:documentId/match', handler: 'registrations.match', config: adminGuard },
    { method: 'GET', path: '/club/registrations/:documentId/confirm-context', handler: 'registrations.confirmContext', config: adminGuard },
```

and in `05-athletes.ts` insert as the FIRST entry (before every `/:documentId` path):

```ts
    { method: 'GET', path: '/club/athletes/search', handler: 'athletes.search', config: adminGuard },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/search.ts src/club/athletes/cards.ts src/club/athletes/confirm-read.ts src/club/athletes/__tests__/search.test.ts src/club/athletes/__tests__/confirm-read.test.ts src/api/club
git commit -m "feat(inscrieri): match card, confirm window context and athlete search routes"
```

---

### Task 17: Confirm a registration (all or nothing, one at a time)

**Files:**
- Create: `src/club/athletes/confirm-service.ts`
- Modify: `src/api/club/controllers/registrations.ts` (`confirm`), `src/api/club/routes/04-registrations.ts`
- Test: `src/club/athletes/__tests__/confirm-service.test.ts`

**Interfaces:**
- Consumes: `planConfirmation`, `confirmRefusal`, `confirmationRecord`, `readConfirmRequest`, `ConfirmRequest`, `ConfirmFacts` (Task 7); `confirmationHistory` (Task 7); `comparisonRows`, `defaultUpdateFields`, `registrationValues`; `registrationSeason`, `seasonRunning`; `groupOptions` (Task 16); `refreshAllMatches`, `safely` (Task 12); `ServiceContext`, `AthleteRow`, `RegistrationRow` (Task 11); `CONFIRM_ERRORS`, `ADMIN_ERRORS`; `serviceContext` (Task 11).
- Produces:
  - `confirmRegistration(ctx: ServiceContext, registrationId: string, request: ConfirmRequest): Promise<AdminResult<ConfirmResponse>>`
  - `POST /api/club/registrations/:documentId/confirm`: 200 `{ data: ConfirmResponse }`; 409 "Înscrierea a fost deja confirmată de alt administrator."; 400 "Data nașterii nu poate fi citită. Corectați-o în Date."; 400 or 500 "Confirmarea nu a reușit. Nimic nu a fost salvat."; 404.

- [ ] **Step 1: Write the failing test**

`src/club/athletes/__tests__/confirm-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { CONFIRM_ERRORS } from '../errors';
import { confirmRegistration } from '../confirm-service';
import type { ConfirmRequest } from '../../confirm/plan';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const existing = (over: Partial<ConfirmRequest> = {}): ConfirmRequest => ({ choice: 'existing', athleteId: 'a1', groupId: 'g-pp', makeMain: false, updateFields: null, ...over });
const seed = () => ({
  athletes: [athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0711', status: 'inactiv', profileId: 'sp1' })],
  registrations: [registrationRow({ id: 'r1', status: 'Contactat' })],
  profiles: [{ id: 'sp1', name: 'Maria Pop', slug: 'maria-pop', previousSlugs: [], showPublicPage: true, published: true }],
});

describe('Sportiv existent (spec 4.5)', () => {
  it('links, applies the default ticks, reactivates, adds the group and A.C.S., writes both histories', async () => {
    const fake = fakeClubStore(seed());
    const result = await confirmRegistration(ctx(fake), 'r1', existing());
    expect(result).toEqual({ ok: true, data: { athleteId: 'a1', athleteName: 'Maria Pop', registrationId: 'r1' } });
    const reg = fake.state.registrations[0];
    expect([reg.athleteId, reg.status, reg.matchAthleteId, reg.confirmation?.previousStatus]).toEqual(['a1', 'Confirmat', null, 'Contactat']);
    expect(fake.state.athletes[0]).toMatchObject({ phone: '0722111222', contactName: 'Ana Pop', email: 'ana@example.com', status: 'activ', dataIncomplete: false });
    expect(fake.state.memberships).toEqual([{ id: expect.any(String), athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: '2026-10-26' }]);
    expect(fake.state.acs).toEqual([{ id: expect.any(String), athleteId: 'a1', seasonId: 's26', state: 'in_asteptare' }]);
    expect(fake.state.history.map((h) => h.action)).toEqual(['confirmed', 'registration-confirmed', 'updated', 'group-added', 'acs-changed', 'reactivated']);
    expect(fake.state.locks).toEqual(['r1']);
  });

  it('renames the public profile when the name is ticked; the slug stays', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1', childName: 'Maria Ioana Pop' })] });
    await confirmRegistration(ctx(fake), 'r1', existing({ updateFields: ['name'] }));
    expect(fake.state.profiles[0]).toMatchObject({ name: 'Maria Ioana Pop', slug: 'maria-pop' });
  });

  it('a second registration of the same child adds nothing twice (r4 e5)', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1' }), registrationRow({ id: 'r2', number: '2026-0150' })] });
    await confirmRegistration(ctx(fake), 'r1', existing());
    await confirmRegistration(ctx(fake), 'r2', existing());
    expect([fake.state.memberships.length, fake.state.acs.length]).toEqual([1, 1]);
  });
});

describe('Sportiv nou (spec 4.5)', () => {
  it('creates the athlete from the registration, activ, linked', async () => {
    const fake = fakeClubStore(seed());
    const result = await confirmRegistration(ctx(fake), 'r1', { choice: 'new', athleteId: null, groupId: null, makeMain: false, updateFields: null });
    const created = fake.state.athletes[1];
    expect(result.ok && result.data.athleteId).toBe(created.id);
    expect(created).toMatchObject({ name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', status: 'activ', dataIncomplete: false });
    expect(fake.state.registrations[0].confirmation?.createdAthlete).toBe(true);
  });
});

describe('errors and concurrency (spec 4.7)', () => {
  it('the second confirmation is refused and nothing is doubled', async () => {
    const fake = fakeClubStore(seed());
    await confirmRegistration(ctx(fake), 'r1', existing());
    const second = await confirmRegistration(ctx(fake), 'r1', { choice: 'new', athleteId: null, groupId: null, makeMain: false, updateFields: null });
    expect(second).toEqual({ ok: false, status: 409, error: CONFIRM_ERRORS.taken });
    expect(fake.state.athletes).toHaveLength(1);
  });

  it('all or nothing: a failing write leaves no athlete, link, group, A.C.S. or history', async () => {
    const fake = fakeClubStore(seed());
    fake.failOn('createAcs');
    const result = await confirmRegistration(ctx(fake), 'r1', { choice: 'new', athleteId: null, groupId: 'g-pp', makeMain: false, updateFields: null });
    expect(result).toEqual({ ok: false, status: 500, error: CONFIRM_ERRORS.failed });
    expect([fake.state.athletes.length, fake.state.memberships.length, fake.state.acs.length, fake.state.history.length]).toEqual([1, 0, 0, 0]);
    expect(fake.state.registrations[0]).toMatchObject({ athleteId: null, status: 'Contactat', confirmation: null });
  });

  it('refuses an unreadable birth date, an unknown athlete or a group outside the picker', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1', childBirthDate: 'martie' }), registrationRow({ id: 'r2' })] });
    expect(await confirmRegistration(ctx(fake), 'r1', existing())).toEqual({ ok: false, status: 400, error: CONFIRM_ERRORS.birthDate });
    expect(await confirmRegistration(ctx(fake), 'r2', existing({ athleteId: 'nope' }))).toEqual({ ok: false, status: 400, error: CONFIRM_ERRORS.failed });
    expect(await confirmRegistration(ctx(fake), 'r2', existing({ groupId: 'g-nope' }))).toEqual({ ok: false, status: 400, error: CONFIRM_ERRORS.failed });
  });

  it('refreshes the saved matches after a confirmation', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1' }), registrationRow({ id: 'r2', number: '2026-0150' })] });
    await confirmRegistration(ctx(fake), 'r1', existing());
    expect(fake.state.registrations[1]).toMatchObject({ matchAthleteId: 'a1', matchLevel: 'sigur' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/athletes/__tests__/confirm-service.test.ts`
Expected: FAIL with "Cannot find module '../confirm-service'".

- [ ] **Step 3: Write the implementation**

`src/club/athletes/confirm-service.ts`:

```ts
import { refuse, type AdminResult } from '../admin-result';
import { pickAthleteValues } from '../athlete-data';
import { comparisonRows, defaultUpdateFields, registrationValues } from '../confirm/compare';
import { confirmationHistory } from '../confirm/history';
import { confirmRefusal, confirmationRecord, planConfirmation, type ConfirmFacts, type ConfirmPlan, type ConfirmRequest } from '../confirm/plan';
import { registrationSeason, seasonRunning, type SeasonFacts } from '../confirm/season';
import type { ConfirmResponse } from './api-types';
import { groupOptions } from './cards';
import { ADMIN_ERRORS, CONFIRM_ERRORS } from './errors';
import { refreshAllMatches, safely } from './matches';
import type { AthleteRow, ClubStore, RegistrationRow, ServiceContext } from './store';

/**
 * "Confirmă înscrierea" (spec 4.5 to 4.7): one transaction holding the registration row, so a second admin waits
 * and then gets 409; any failure rolls everything back.
 */
type Result = AdminResult<ConfirmResponse>;
type Loaded = { facts: ConfirmFacts; athlete: AthleteRow | null };

async function seasonRows(store: ClubStore, athleteId: string, seasonId: string): Promise<Pick<ConfirmFacts, 'seasonMemberships' | 'seasonAcs'>> {
  const [memberships, acs] = await Promise.all([store.memberships(athleteId), store.acsRows(athleteId)]);
  const own = acs.find((r) => r.seasonId === seasonId);
  return {
    seasonMemberships: memberships.filter((m) => m.seasonId === seasonId).map(({ id, groupId, isMain }) => ({ id, groupId, isMain })),
    seasonAcs: own ? { id: own.id, state: own.state } : null,
  };
}

function updateFieldsFor(request: ConfirmRequest, athlete: AthleteRow | null, reg: RegistrationRow) {
  if (request.updateFields) return request.updateFields;
  return athlete ? defaultUpdateFields(comparisonRows(pickAthleteValues(athlete), reg)) : [];
}

async function pickGroup(store: ClubStore, reg: RegistrationRow, groupId: string | null): Promise<{ id: string; name: string } | null | undefined> {
  if (!groupId) return null;
  const [sections, groups] = await Promise.all([store.sections(), store.groups()]);
  const hit = groupOptions(reg.sectionId, sections, groups).flatMap((s) => s.groups).find((g) => g.documentId === groupId);
  return hit ? { id: hit.documentId, name: hit.name } : undefined;
}

async function loadFacts(ctx: ServiceContext, reg: RegistrationRow, request: ConfirmRequest): Promise<AdminResult<Loaded>> {
  const athlete = request.athleteId ? await ctx.store.athlete(request.athleteId) : null;
  const group = await pickGroup(ctx.store, reg, request.groupId);
  if ((request.choice === 'existing' && !athlete) || group === undefined) return refuse(400, CONFIRM_ERRORS.failed);
  const season: SeasonFacts | null = registrationSeason(reg, await ctx.store.seasons());
  const own = athlete && season ? await seasonRows(ctx.store, athlete.id, season.id) : { seasonMemberships: [], seasonAcs: null };
  const registration = { id: reg.id, number: reg.number ?? '', status: reg.status, membershipAnswer: reg.membershipAnswer, values: registrationValues(reg) };
  const facts: ConfirmFacts = {
    registration, athlete, season, running: seasonRunning(season, ctx.today), today: ctx.today, ...own, group,
    makeMain: request.makeMain, updateFields: updateFieldsFor(request, athlete, reg),
  };
  return { ok: true, data: { facts, athlete } };
}

async function writeAthlete(store: ClubStore, plan: ConfirmPlan, athlete: AthleteRow | null): Promise<string> {
  if (plan.newAthlete) return store.createAthlete(plan.newAthlete);
  if (!athlete) throw new Error('confirmation without an athlete');
  if (plan.athleteUpdate) await store.updateAthlete(athlete.id, plan.athleteUpdate);
  if (plan.renameProfile && athlete.profileId) await store.renameProfile(athlete.profileId, plan.renameProfile);
  return athlete.id;
}

async function writeMembership(store: ClubStore, plan: ConfirmPlan, athleteId: string): Promise<string | null> {
  if (plan.demoteMainId) await store.updateMembership(plan.demoteMainId, { isMain: false });
  return plan.membership ? store.createMembership({ athleteId, ...plan.membership }) : null;
}

async function writeAcs(store: ClubStore, plan: ConfirmPlan, athleteId: string): Promise<string | null> {
  if (!plan.acs) return null;
  if (plan.acs.existingId === null) return store.createAcs({ athleteId, seasonId: plan.acs.seasonId, state: plan.acs.to });
  await store.updateAcs(plan.acs.existingId, { state: plan.acs.to });
  return plan.acs.existingId;
}

async function apply(ctx: ServiceContext, reg: RegistrationRow, { facts, athlete }: Loaded): Promise<Result> {
  const plan = planConfirmation(facts);
  const athleteId = await writeAthlete(ctx.store, plan, athlete);
  const membershipId = await writeMembership(ctx.store, plan, athleteId);
  const acsId = await writeAcs(ctx.store, plan, athleteId);
  const confirmation = confirmationRecord({ plan, facts, athleteId, membershipId, acsId, at: new Date().toISOString() });
  await ctx.store.updateRegistration(reg.id, { athleteId, status: 'Confirmat', confirmation, matchAthleteId: null, matchLevel: null });
  const athleteName = plan.newAthlete?.name ?? plan.renameProfile ?? athlete?.name ?? '';
  const entries = confirmationHistory({ plan, registrationId: reg.id, registrationNumber: reg.number ?? '', athleteId, athleteName, actor: ctx.actor });
  for (const entry of entries) await ctx.store.record(entry);
  return { ok: true, data: { athleteId, athleteName, registrationId: reg.id } };
}

async function confirmLocked(ctx: ServiceContext, id: string, request: ConfirmRequest): Promise<Result> {
  await ctx.store.lockRegistration(id);
  const reg = await ctx.store.registration(id);
  if (!reg) return refuse(404, ADMIN_ERRORS.notFound);
  const refusal = confirmRefusal(reg, request);
  if (refusal) return refuse(refusal.status, refusal.error);
  const loaded = await loadFacts(ctx, reg, request);
  return loaded.ok === true ? apply(ctx, reg, loaded.data) : loaded;
}

export async function confirmRegistration(ctx: ServiceContext, registrationId: string, request: ConfirmRequest): Promise<Result> {
  let result: Result;
  try {
    result = await ctx.store.transaction(() => confirmLocked(ctx, registrationId, request));
  } catch (err) {
    ctx.log(`[confirm] ${registrationId} failed: ${err instanceof Error ? err.message : String(err)}`);
    return refuse(500, CONFIRM_ERRORS.failed);
  }
  if (result.ok === true) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after a confirmation');
  return result;
}
```

In `src/api/club/controllers/registrations.ts` add the imports and the handler:

```ts
import { CONFIRM_ERRORS } from '../../../club/athletes/errors';
import { confirmRegistration } from '../../../club/athletes/confirm-service';
import { serviceContext } from '../../../club/athletes/http';
import { readConfirmRequest } from '../../../club/confirm/plan';
```

(merge `CONFIRM_ERRORS` into the existing `errors` import and `serviceContext` into the existing `http` import)

```ts
  async confirm(ctx: AdminCtx) {
    const request = readConfirmRequest(ctx.request.body);
    if (!request) return refuseWith(ctx, 400, CONFIRM_ERRORS.failed);
    respond(ctx, await confirmRegistration(await serviceContext(strapi, ctx), ctx.params.documentId ?? '', request));
  },
```

In `04-registrations.ts` append:

```ts
    { method: 'POST', path: '/club/registrations/:documentId/confirm', handler: 'registrations.confirm', config: adminGuard },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/confirm-service.ts src/club/athletes/__tests__/confirm-service.test.ts src/api/club
git commit -m "feat(inscrieri): confirm a registration in one transaction"
```

---
### Task 18: Undo a confirmation

**Files:**
- Create: `src/club/athletes/undo-service.ts`
- Modify: `src/api/club/controllers/registrations.ts` (`undo`), `src/api/club/routes/04-registrations.ts`
- Test: `src/club/athletes/__tests__/undo-service.test.ts`

**Interfaces:**
- Consumes: `planUndo`, `undoAllowed`, `UndoFacts`, `UndoPlan` (Task 8); `ConfirmationRecord`; `HISTORY_ACTIONS`, `SUBJECT`; `refreshAllMatches`, `safely`; `ServiceContext`, `ClubStore`, `RegistrationRow`; `ADMIN_ERRORS`; `confirmRegistration` (tests only).
- Produces:
  - `undoConfirmation(ctx: ServiceContext, registrationId: string): Promise<AdminResult<UndoResponse>>`
  - `POST /api/club/registrations/:documentId/undo-confirmation` (the toast "Anulează" and the panel's "Anulează confirmarea"): 200 `{ data: { status, athleteDeleted } }`; 409 `ADMIN_ERRORS.stale` when the registration was not confirmed through the window or its link changed; 500 `ADMIN_ERRORS.failed`; 404.

- [ ] **Step 1: Write the failing test**

`src/club/athletes/__tests__/undo-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { confirmRegistration } from '../confirm-service';
import { ADMIN_ERRORS } from '../errors';
import { undoConfirmation } from '../undo-service';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const seed = () => ({
  athletes: [athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0711', status: 'inactiv' })],
  registrations: [registrationRow({ id: 'r1', status: 'Contactat' })],
  memberships: [{ id: 'm0', athleteId: 'a1', groupId: 'g-pro', seasonId: 's26', isMain: true, from: '2026-10-01' }],
});

async function confirmed(fake: Fake, choice: 'existing' | 'new' = 'existing') {
  const athleteId = choice === 'existing' ? 'a1' : null;
  await confirmRegistration(ctx(fake), 'r1', { choice, athleteId, groupId: 'g-pp', makeMain: true, updateFields: null });
}

describe('Anulează confirmarea (spec 4.6)', () => {
  it('reverts the link, status, group, main group, A.C.S., fields and reactivation; logs on both records', async () => {
    const fake = fakeClubStore(seed());
    await confirmed(fake);
    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: true, data: { status: 'Contactat', athleteDeleted: false } });
    expect(fake.state.registrations[0]).toMatchObject({ athleteId: null, status: 'Contactat', confirmation: null, matchAthleteId: 'a1', matchLevel: 'sigur' });
    expect(fake.state.athletes[0]).toMatchObject({ phone: '0711', contactName: null, status: 'inactiv' });
    expect(fake.state.memberships).toEqual([{ id: 'm0', athleteId: 'a1', groupId: 'g-pro', seasonId: 's26', isMain: true, from: '2026-10-01' }]);
    expect(fake.state.acs).toEqual([]);
    expect(fake.state.history.filter((h) => h.action === 'confirmation-undone').map((h) => h.subjectId)).toEqual(['r1', 'a1']);
  });

  it('keeps an edit made after the confirmation', async () => {
    const fake = fakeClubStore(seed());
    await confirmed(fake);
    await fake.store.updateAthlete('a1', { phone: '0799' });
    await undoConfirmation(ctx(fake), 'r1');
    expect(fake.state.athletes[0].phone).toBe('0799');
  });

  it('removes a new athlete that has nothing else', async () => {
    const fake = fakeClubStore(seed());
    await confirmed(fake, 'new');
    expect(fake.state.athletes).toHaveLength(2);
    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: true, data: { status: 'Contactat', athleteDeleted: true } });
    expect(fake.state.athletes.map((a) => a.id)).toEqual(['a1']);
  });

  it('refuses a registration not confirmed through the window', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1', status: 'Confirmat' })] });
    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
  });

  it('rolls back on a failure', async () => {
    const fake = fakeClubStore(seed());
    await confirmed(fake);
    fake.failOn('updateAthlete');
    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect(fake.state.registrations[0]).toMatchObject({ athleteId: 'a1', status: 'Confirmat' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/athletes/__tests__/undo-service.test.ts`
Expected: FAIL with "Cannot find module '../undo-service'".

- [ ] **Step 3: Write the implementation**

`src/club/athletes/undo-service.ts`:

```ts
import { refuse, type AdminResult } from '../admin-result';
import type { ConfirmationRecord } from '../confirm/plan';
import { planUndo, undoAllowed, type UndoFacts, type UndoPlan } from '../confirm/undo-plan';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import type { UndoResponse } from './api-types';
import { ADMIN_ERRORS } from './errors';
import { refreshAllMatches, safely } from './matches';
import type { ClubStore, RegistrationRow, ServiceContext } from './store';

/** "Anulează confirmarea" (spec 4.6, gaps #32): one transaction on the locked registration row. */
type Result = AdminResult<UndoResponse>;

async function loadFacts(store: ClubStore, reg: RegistrationRow, record: ConfirmationRecord): Promise<UndoFacts | null> {
  const athlete = await store.athlete(record.athleteId);
  if (!athlete || !undoAllowed(record, reg.athleteId, athlete.id)) return null;
  const [memberships, acs, linked] = await Promise.all([store.memberships(athlete.id), store.acsRows(athlete.id), store.registrations({ athleteId: athlete.id })]);
  return {
    record, linkedAthleteId: reg.athleteId, athlete,
    membershipIds: memberships.map((m) => m.id),
    acsRows: acs.map(({ id, state }) => ({ id, state })),
    otherRegistrations: linked.filter((r) => r.id !== reg.id).length,
  };
}

async function revertRows(store: ClubStore, plan: UndoPlan): Promise<void> {
  if (plan.deleteMembershipId) await store.deleteMembership(plan.deleteMembershipId);
  if (plan.restoreMainId) await store.updateMembership(plan.restoreMainId, { isMain: true });
  if (plan.acs?.op === 'delete') await store.deleteAcs(plan.acs.id);
  if (plan.acs?.op === 'set') await store.updateAcs(plan.acs.id, { state: plan.acs.state });
}

async function revertAthlete(store: ClubStore, athlete: UndoFacts['athlete'], plan: UndoPlan): Promise<void> {
  if (plan.deleteAthlete) return store.deleteAthlete(athlete.id);
  if (plan.athleteUpdate) await store.updateAthlete(athlete.id, plan.athleteUpdate);
  if (plan.renameProfile && athlete.profileId) await store.renameProfile(athlete.profileId, plan.renameProfile);
}

async function applyUndo(ctx: ServiceContext, reg: RegistrationRow, facts: UndoFacts): Promise<Result> {
  const plan = planUndo(facts);
  await revertRows(ctx.store, plan);
  await ctx.store.updateRegistration(reg.id, { athleteId: null, status: plan.registration.status, confirmation: null });
  await revertAthlete(ctx.store, facts.athlete, plan);
  const undone = { action: HISTORY_ACTIONS.confirmationUndone, actor: ctx.actor };
  await ctx.store.record({ subjectType: SUBJECT.registration, subjectId: reg.id, ...undone });
  await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: facts.athlete.id, ...undone });
  return { ok: true, data: { status: plan.registration.status, athleteDeleted: plan.deleteAthlete } };
}

async function undoLocked(ctx: ServiceContext, id: string): Promise<Result> {
  await ctx.store.lockRegistration(id);
  const reg = await ctx.store.registration(id);
  if (!reg) return refuse(404, ADMIN_ERRORS.notFound);
  const facts = reg.confirmation ? await loadFacts(ctx.store, reg, reg.confirmation) : null;
  return facts ? applyUndo(ctx, reg, facts) : refuse(409, ADMIN_ERRORS.stale);
}

export async function undoConfirmation(ctx: ServiceContext, registrationId: string): Promise<Result> {
  let result: Result;
  try {
    result = await ctx.store.transaction(() => undoLocked(ctx, registrationId));
  } catch (err) {
    ctx.log(`[undo] ${registrationId} failed: ${err instanceof Error ? err.message : String(err)}`);
    return refuse(500, ADMIN_ERRORS.failed);
  }
  if (result.ok === true) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after an undo');
  return result;
}
```

In `src/api/club/controllers/registrations.ts` import `undoConfirmation` from `'../../../club/athletes/undo-service'` and add:

```ts
  async undo(ctx: AdminCtx) {
    respond(ctx, await undoConfirmation(await serviceContext(strapi, ctx), ctx.params.documentId ?? ''));
  },
```

In `04-registrations.ts` append:

```ts
    { method: 'POST', path: '/club/registrations/:documentId/undo-confirmation', handler: 'registrations.undo', config: adminGuard },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/undo-service.ts src/club/athletes/__tests__/undo-service.test.ts src/api/club
git commit -m "feat(inscrieri): undo a confirmation"
```

---

### Task 19: Move to another school

**Files:**
- Create: `src/club/athletes/school-move.ts`
- Modify: `src/api/club/controllers/registrations.ts` (`moveSchool`, `moveSchoolBulk`), `src/api/club/routes/04-registrations.ts`
- Test: `src/club/athletes/__tests__/school-move.test.ts`

**Interfaces:**
- Consumes: `ServiceContext`, `SectionRow`; `HISTORY_ACTIONS`, `SUBJECT`; `ADMIN_ERRORS`; `refuse`, `AdminResult`.
- Produces:
  - `schoolSections(sections: SectionRow[]): SectionRow[]`; `readMoveSchool(body: unknown): { ids: string[]; sectionId: string } | null`
  - `moveToSchool(ctx: ServiceContext, ids: string[], sectionId: string): Promise<AdminResult<MoveSchoolResponse>>`
  - `POST /api/club/registrations/move-school` body `{ documentIds: string[], sectionId }` → `{ data: { moved, skipped } }`; `POST /api/club/registrations/:documentId/move-school` body `{ sectionId }` → same, 409 `ADMIN_ERRORS.stale` when nothing moved; 400 `ADMIN_ERRORS.invalid` with fewer than 2 schools or a target that is not one.

- [ ] **Step 1: Write the failing test**

`src/club/athletes/__tests__/school-move.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_ERRORS } from '../errors';
import { moveToSchool, readMoveSchool } from '../school-move';
import { fakeClubStore, registrationRow, SECTIONS, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const twoSchools = [...SECTIONS, { id: 'p2', name: 'Patinoar 2', kind: 'school' as const, publicPage: true, order: 3 }];
const choice = { priceItemName: 'Abonament 8 ședințe grup', price: 770 };

describe('Mută la altă școală (spec 3.6, r4 e12)', () => {
  it('moves unconfirmed registrations, keeps number and subscription choice, logs "Mutată la"', async () => {
    const fake = fakeClubStore({
      sections: twoSchools,
      registrations: [registrationRow({ id: 'r1', subscriptionChoice: choice }), registrationRow({ id: 'r2', athleteId: 'a1' }), registrationRow({ id: 'r3', sectionId: 'p2' })],
    });
    expect(await moveToSchool(ctx(fake), ['r1', 'r2', 'r3', 'nope'], 'p2')).toEqual({ ok: true, data: { moved: 1, skipped: 3 } });
    expect(fake.state.registrations[0]).toMatchObject({ sectionId: 'p2', number: '2026-0142', subscriptionChoice: choice });
    expect(fake.state.registrations[1].sectionId).toBe('afi');
    expect(fake.state.history.map((h) => [h.subjectId, h.action, h.changes])).toEqual([['r1', 'school-moved', { schoolName: 'Patinoar 2' }]]);
  });

  it('only with 2+ schools, only to a school', async () => {
    const one = fakeClubStore({ registrations: [registrationRow({ id: 'r1' })] });
    expect(await moveToSchool(ctx(one), ['r1'], 'afi')).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.invalid });
    const two = fakeClubStore({ sections: twoSchools, registrations: [registrationRow({ id: 'r1' })] });
    expect(await moveToSchool(ctx(two), ['r1'], 'club')).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.invalid });
  });

  it('reads the bulk body', () => {
    expect(readMoveSchool({ documentIds: ['r1', '', 3], sectionId: ' p2 ' })).toEqual({ ids: ['r1'], sectionId: 'p2' });
    expect(readMoveSchool({ documentIds: [], sectionId: 'p2' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/athletes/__tests__/school-move.test.ts`
Expected: FAIL with "Cannot find module '../school-move'".

- [ ] **Step 3: Write the implementation**

`src/club/athletes/school-move.ts`:

```ts
import { refuse, type AdminResult } from '../admin-result';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import type { MoveSchoolResponse } from './api-types';
import { ADMIN_ERRORS } from './errors';
import type { SectionRow, ServiceContext } from './store';

/**
 * "Mută la altă școală" (spec 3.6): only with 2+ schools, only before confirmation; the number and the frozen
 * subscription choice stay (gaps #27); no PDF rebuild; Istoric "Mutată la <școală>".
 */
export function schoolSections(sections: SectionRow[]): SectionRow[] {
  return sections.filter((s) => s.kind === 'school' && s.publicPage).sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
}

export function readMoveSchool(body: unknown): { ids: string[]; sectionId: string } | null {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const ids = Array.isArray(b.documentIds) ? b.documentIds.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
  const sectionId = typeof b.sectionId === 'string' ? b.sectionId.trim() : '';
  return ids.length && sectionId ? { ids, sectionId } : null;
}

async function moveOne(ctx: ServiceContext, id: string, target: SectionRow): Promise<boolean> {
  const reg = await ctx.store.registration(id);
  if (!reg || reg.athleteId || reg.sectionId === target.id) return false;
  await ctx.store.updateRegistration(id, { sectionId: target.id });
  await ctx.store.record({ subjectType: SUBJECT.registration, subjectId: id, action: HISTORY_ACTIONS.schoolMoved, changes: { schoolName: target.name }, actor: ctx.actor });
  return true;
}

export async function moveToSchool(ctx: ServiceContext, ids: string[], sectionId: string): Promise<AdminResult<MoveSchoolResponse>> {
  const schools = schoolSections(await ctx.store.sections());
  const target = schools.find((s) => s.id === sectionId);
  if (schools.length < 2 || !target) return refuse(400, ADMIN_ERRORS.invalid);
  let moved = 0;
  for (const id of ids) if (await moveOne(ctx, id, target)) moved += 1;
  return { ok: true, data: { moved, skipped: ids.length - moved } };
}
```

In `src/api/club/controllers/registrations.ts` import `moveToSchool, readMoveSchool` from `'../../../club/athletes/school-move'` and add:

```ts
  async moveSchool(ctx: AdminCtx) {
    const sectionId = queryText((ctx.request.body as { sectionId?: unknown } | undefined)?.sectionId);
    const result = await moveToSchool(await serviceContext(strapi, ctx), [ctx.params.documentId ?? ''], sectionId);
    if (result.ok === true && result.data.moved === 0) return refuseWith(ctx, 409, ADMIN_ERRORS.stale);
    respond(ctx, result);
  },

  async moveSchoolBulk(ctx: AdminCtx) {
    const request = readMoveSchool(ctx.request.body);
    if (!request) return refuseWith(ctx, 400, ADMIN_ERRORS.invalid);
    respond(ctx, await moveToSchool(await serviceContext(strapi, ctx), request.ids, request.sectionId));
  },
```

In `04-registrations.ts`, insert as the FIRST route (before every `/:documentId` path):

```ts
    { method: 'POST', path: '/club/registrations/move-school', handler: 'registrations.moveSchoolBulk', config: adminGuard },
```

and append:

```ts
    { method: 'POST', path: '/club/registrations/:documentId/move-school', handler: 'registrations.moveSchool', config: adminGuard },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/school-move.ts src/club/athletes/__tests__/school-move.test.ts src/api/club
git commit -m "feat(inscrieri): move registrations to another school"
```

---

### Task 20: Sportivi list

**Files:**
- Create: `src/club/athletes/list.ts`
- Modify: `src/api/club/controllers/athletes.ts` (`list`), `src/api/club/routes/05-athletes.ts`
- Test: `src/club/athletes/__tests__/list.test.ts`

**Interfaces:**
- Consumes: `isAcsState`, `AcsState`; `ATHLETE_STATUSES`, `MISSING_FIELD_WORDS`, `birthDateForPicker`, `missingFields`, `pickAthleteValues`, `AthleteStatus`; `ageFromIso`, `DateParts`; `registrationSeasonLabel` (Task 16); `matchesQuery`, `searchSubjects`, `SearchSubject` (Task 16); store rows; `AthleteListPage`, `AthleteListRow`.
- Produces:
  - `type AthleteListQuery = { seasonId: string | null; q: string; status: AthleteStatus[]; sections: string[]; groups: string[]; noGroup: boolean; acs: AcsState[]; profile: ('public' | 'ascuns')[]; data: ('complete' | 'incomplete')[]; duplicates: boolean; sort: 'name' | 'age' | 'group'; dir: 'asc' | 'desc'; page: number; pageSize: 30 | 50 }`
  - `NO_SECTION = 'none'`, `readListQuery(q: Record<string, unknown>): AthleteListQuery`, `listAthletes(src: ListSource, q): AthleteListPage`, `athleteListPage(store, q, today): Promise<AthleteListPage>`
  - `GET /api/club/athletes?season=&q=&status=&section=&group=&noGroup=&acs=&profile=&data=&duplicates=&sort=&dir=&page=&pageSize=` (lists are comma-separated; `section=none` = "Fără secțiune") → `AthleteListPage` (not wrapped in `{ data }` twice: the body is the page itself, like the Înscrieri list).

- [ ] **Step 1: Write the failing test**

`src/club/athletes/__tests__/list.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { athleteListPage, readListQuery } from '../list';
import { athleteRow, fakeClubStore, registrationRow } from './fake-store';

const TODAY = { year: 2026, month: 10, day: 26 };
const full = { contactName: 'Ana', phone: '07', email: 'e', dataIncomplete: false };
const fake = () => fakeClubStore({
  athletes: [
    athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', profileId: 'sp1', ...full }),
    athleteRow({ id: 'a2', name: 'Andrei Ionescu', birthDate: '2012-01-01', contactName: 'Ion', phone: '07' }),
    athleteRow({ id: 'a3', name: 'Ion Ilie', status: 'inactiv' }),
    athleteRow({ id: 'a4', name: 'Bianca Radu' }),
  ],
  memberships: [
    { id: 'm1', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null },
    { id: 'm2', athleteId: 'a2', groupId: 'g-pro', seasonId: 's26', isMain: true, from: null },
  ],
  acs: [{ id: 'c1', athleteId: 'a1', seasonId: 's26', state: 'in_asteptare' }, { id: 'c2', athleteId: 'a2', seasonId: 's26', state: 'da' }],
  registrations: [registrationRow({ id: 'r4', athleteId: 'a4', parentName: 'Dana Radu', number: '2026-0099' })],
  profiles: [{ id: 'sp1', name: 'Maria Pop', slug: 'maria-pop', previousSlugs: [], showPublicPage: true, published: true }],
  duplicates: [{ id: 'd1', firstId: 'a4', secondId: 'a1' }],
});
const ids = async (query: Record<string, unknown>) => (await athleteListPage(fake().store, readListQuery(query), TODAY)).data.map((r) => r.documentId);

describe('Sportivi list (spec 5)', () => {
  it('hides inactive athletes unless asked; Nume A-Z by default; counts and banner', async () => {
    const page = await athleteListPage(fake().store, readListQuery({}), TODAY);
    expect(page.data.map((r) => r.documentId)).toEqual(['a2', 'a4', 'a1']);
    expect([page.unfiltered, page.incomplete, page.pagination.total, page.season?.label]).toEqual([3, 2, 3, '2026-2027']);
    expect(await ids({ status: 'inactiv' })).toEqual(['a3']);
  });

  it('a row: age, group of the season, contact, A.C.S., profile, missing fields', async () => {
    const page = await athleteListPage(fake().store, readListQuery({}), TODAY);
    expect(page.data.find((r) => r.documentId === 'a1')).toEqual({
      documentId: 'a1', name: 'Maria Pop', age: 10, birthDate: '14.03.2016', status: 'activ', dataIncomplete: false, missing: [],
      mainGroup: { documentId: 'g-pp', name: 'Primii Pași' }, contactName: 'Ana', phone: '07', acs: 'in_asteptare', publicProfile: 'public', possibleDuplicate: true,
    });
    expect(page.data.find((r) => r.documentId === 'a4')).toMatchObject({ age: null, mainGroup: null, acs: 'nu', publicProfile: 'ascuns', missing: ['data nașterii', 'persoana de contact', 'telefon', 'e-mail'] });
  });

  it('Secțiune: groups of the season, else registrations of the season, else "Fără secțiune" (gaps #35)', async () => {
    expect(await ids({ section: 'afi' })).toEqual(['a4', 'a1']);
    expect(await ids({ section: 'club' })).toEqual(['a2']);
    expect(await ids({ section: 'none', status: 'inactiv' })).toEqual(['a3']);
  });

  it('Grupa, Fără grupă, Membru A.C.S., Profil public, Date, Posibile dubluri', async () => {
    expect(await ids({ group: 'g-pro' })).toEqual(['a2']);
    expect(await ids({ noGroup: 'true' })).toEqual(['a4']);
    expect(await ids({ group: 'g-pro', noGroup: 'true' })).toEqual(['a2', 'a4']);
    expect(await ids({ acs: 'nu' })).toEqual(['a4']);
    expect(await ids({ profile: 'public' })).toEqual(['a1']);
    expect(await ids({ data: 'incomplete' })).toEqual(['a2', 'a4']);
    expect(await ids({ duplicates: 'true' })).toEqual(['a4', 'a1']);
  });

  it('searches name, parent and registration number', async () => {
    expect(await ids({ q: 'maria' })).toEqual(['a1']);
    expect(await ids({ q: 'dana radu' })).toEqual(['a4']);
    expect(await ids({ q: '2026-0099' })).toEqual(['a4']);
  });

  it('sorts by age and by group', async () => {
    expect(await ids({ sort: 'age' })).toEqual(['a1', 'a2', 'a4']);
    expect(await ids({ sort: 'group' })).toEqual(['a1', 'a2', 'a4']);
    expect(await ids({ sort: 'name', dir: 'desc' })).toEqual(['a1', 'a4', 'a2']);
  });

  it('the season selector only changes the group and A.C.S. columns (3b s5)', async () => {
    const page = await athleteListPage(fake().store, readListQuery({ season: 's25' }), TODAY);
    expect(page.data.map((r) => [r.documentId, r.mainGroup, r.acs])).toEqual([['a2', null, 'nu'], ['a4', null, 'nu'], ['a1', null, 'nu']]);
  });

  it('pages 50 (desktop) or 30 (phone), and offers the filter options', async () => {
    const page = await athleteListPage(fake().store, readListQuery({ page: '2', pageSize: '30' }), TODAY);
    expect([page.data, page.pagination]).toEqual([[], { page: 2, pageSize: 30, total: 3, pageCount: 1 }]);
    expect(page.options.sections.map((s) => s.label)).toEqual(['Școala de Patinaj - AFI Cotroceni', 'Club', 'Fără secțiune']);
    expect(page.options.groups.map((g) => [g.label, g.sectionName])).toEqual([
      ['Primii Pași', 'Școala de Patinaj - AFI Cotroceni'], ['Intermediari Bronze', 'Școala de Patinaj - AFI Cotroceni'], ['Profesioniști', 'Club'],
    ]);
  });
});

describe('readListQuery', () => {
  it('drops unknown values', () => {
    expect(readListQuery({ status: 'activ,x', acs: 'da,maybe', profile: 'public,y', data: 'z', sort: 'x', page: '-2', pageSize: '100' })).toMatchObject({
      status: ['activ'], acs: ['da'], profile: ['public'], data: [], sort: 'name', dir: 'asc', page: 1, pageSize: 50,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/athletes/__tests__/list.test.ts`
Expected: FAIL with "Cannot find module '../list'".

- [ ] **Step 3: Write the implementation**

`src/club/athletes/list.ts`:

```ts
import { isAcsState, type AcsState } from '../acs';
import { ATHLETE_STATUSES, MISSING_FIELD_WORDS, birthDateForPicker, missingFields, pickAthleteValues, type AthleteStatus } from '../athlete-data';
import { ageFromIso, type DateParts } from '../birth-date';
import type { AthleteListPage, AthleteListRow } from './api-types';
import { registrationSeasonLabel } from './cards';
import { matchesQuery, searchSubjects, type SearchSubject } from './search';
import type { AcsRow, AthleteRow, ClubStore, DuplicateRow, GroupRow, MembershipRow, ProfileRow, RegistrationRow, SeasonRow, SectionRow } from './store';

/** "Sportivi" (spec 5): every athlete, filtered, searched, sorted and paged on the server. */
export const NO_SECTION = 'none';
const NO_SECTION_LABEL = 'Fără secțiune';

export type AthleteListQuery = {
  seasonId: string | null; q: string; status: AthleteStatus[]; sections: string[]; groups: string[]; noGroup: boolean;
  acs: AcsState[]; profile: ('public' | 'ascuns')[]; data: ('complete' | 'incomplete')[]; duplicates: boolean;
  sort: 'name' | 'age' | 'group'; dir: 'asc' | 'desc'; page: number; pageSize: 30 | 50;
};

const list = (v: unknown): string[] => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const among = <T extends string>(values: readonly T[]) => (v: string): v is T => (values as readonly string[]).includes(v);

function readFilters(q: Record<string, unknown>): Omit<AthleteListQuery, 'sort' | 'dir' | 'page' | 'pageSize'> {
  return {
    seasonId: typeof q.season === 'string' && q.season ? q.season : null,
    q: typeof q.q === 'string' ? q.q : '',
    status: list(q.status).filter(among(ATHLETE_STATUSES)),
    sections: list(q.section),
    groups: list(q.group),
    noGroup: q.noGroup === 'true',
    acs: list(q.acs).filter(isAcsState),
    profile: list(q.profile).filter(among(['public', 'ascuns'] as const)),
    data: list(q.data).filter(among(['complete', 'incomplete'] as const)),
    duplicates: q.duplicates === 'true',
  };
}

export function readListQuery(q: Record<string, unknown>): AthleteListQuery {
  const page = Math.floor(Number(q.page));
  return {
    ...readFilters(q),
    sort: q.sort === 'age' || q.sort === 'group' ? q.sort : 'name',
    dir: q.dir === 'desc' ? 'desc' : 'asc',
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: Number(q.pageSize) === 30 ? 30 : 50,
  };
}

export type ListSource = {
  athletes: AthleteRow[]; registrations: RegistrationRow[]; memberships: MembershipRow[]; acs: AcsRow[]; groups: GroupRow[];
  sections: SectionRow[]; profiles: ProfileRow[]; duplicates: DuplicateRow[]; seasons: SeasonRow[]; season: SeasonRow | null; today: DateParts;
};
type Derived = { row: AthleteListRow; sectionIds: string[]; groupIds: string[]; search: SearchSubject; groupName: string };
type Index = {
  memberships: Map<string, MembershipRow[]>; acs: Map<string, AcsState>; seasonRegistrations: Map<string, RegistrationRow[]>;
  groups: Map<string, GroupRow>; publicProfiles: Set<string>; duplicateIds: Set<string>; subjects: Map<string, SearchSubject>; today: DateParts;
};

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (k) out.set(k, [...(out.get(k) ?? []), row]);
  }
  return out;
}

function buildIndex(src: ListSource): Index {
  const seasonId = src.season?.id ?? null;
  const inSeason = (r: RegistrationRow) => src.season !== null && registrationSeasonLabel(r, src.seasons) === src.season.label;
  return {
    memberships: groupBy(src.memberships.filter((m) => m.seasonId === seasonId), (m) => m.athleteId),
    acs: new Map(src.acs.filter((r) => r.seasonId === seasonId).map((r) => [r.athleteId, r.state])),
    seasonRegistrations: groupBy(src.registrations.filter(inSeason), (r) => r.athleteId),
    groups: new Map(src.groups.map((g) => [g.id, g])),
    publicProfiles: new Set(src.profiles.filter((p) => p.showPublicPage).map((p) => p.id)),
    duplicateIds: new Set(src.duplicates.flatMap((d) => [d.firstId, d.secondId])),
    subjects: searchSubjects(src.athletes, src.registrations),
    today: src.today,
  };
}

/** Secțiune (gaps #35): the groups of the season, else the registrations of the season, else "Fără secțiune". */
function sectionIds(memberships: MembershipRow[], registrations: RegistrationRow[], groups: Map<string, GroupRow>): string[] {
  const fromGroups = memberships.map((m) => groups.get(m.groupId)?.sectionId ?? null).filter((id): id is string => !!id);
  if (fromGroups.length) return [...new Set(fromGroups)];
  const fromRegistrations = registrations.map((r) => r.sectionId).filter((id): id is string => !!id);
  return fromRegistrations.length ? [...new Set(fromRegistrations)] : [NO_SECTION];
}

function mainGroupOf(memberships: MembershipRow[], groups: Map<string, GroupRow>): GroupRow | null {
  const main = memberships.find((m) => m.isMain) ?? memberships[0];
  return (main && groups.get(main.groupId)) || null;
}

function publicRow(a: AthleteRow, ix: Index, group: GroupRow | null): AthleteListRow {
  return {
    documentId: a.id, name: a.name ?? '', age: ageFromIso(a.birthDate, ix.today), birthDate: birthDateForPicker(a.birthDate),
    status: a.status, dataIncomplete: a.dataIncomplete, missing: missingFields(pickAthleteValues(a)).map((f) => MISSING_FIELD_WORDS[f]),
    mainGroup: group ? { documentId: group.id, name: group.name } : null, contactName: a.contactName, phone: a.phone,
    acs: ix.acs.get(a.id) ?? 'nu', publicProfile: a.profileId !== null && ix.publicProfiles.has(a.profileId) ? 'public' : 'ascuns',
    possibleDuplicate: ix.duplicateIds.has(a.id),
  };
}

const EMPTY_SUBJECT: SearchSubject = { names: [], phone: null, texts: [], birthDate: null };

function derive(a: AthleteRow, ix: Index): Derived {
  const memberships = ix.memberships.get(a.id) ?? [];
  const group = mainGroupOf(memberships, ix.groups);
  return {
    row: publicRow(a, ix, group),
    sectionIds: sectionIds(memberships, ix.seasonRegistrations.get(a.id) ?? [], ix.groups),
    groupIds: memberships.map((m) => m.groupId),
    search: ix.subjects.get(a.id) ?? EMPTY_SUBJECT,
    groupName: group?.name ?? '',
  };
}

type Test = (d: Derived, q: AthleteListQuery) => boolean;
const TESTS: Test[] = [
  (d, q) => (q.status.length ? q.status.includes(d.row.status) : d.row.status !== 'inactiv'),
  (d, q) => q.sections.length === 0 || d.sectionIds.some((id) => q.sections.includes(id)),
  (d, q) => (q.groups.length === 0 && !q.noGroup) || q.groups.some((g) => d.groupIds.includes(g)) || (q.noGroup && d.groupIds.length === 0),
  (d, q) => q.acs.length === 0 || q.acs.includes(d.row.acs),
  (d, q) => q.profile.length === 0 || q.profile.includes(d.row.publicProfile),
  (d, q) => q.data.length === 0 || q.data.includes(d.row.dataIncomplete ? 'incomplete' : 'complete'),
  (d, q) => !q.duplicates || d.row.possibleDuplicate,
  (d, q) => matchesQuery(d.search, q.q),
];

const byName = (a: Derived, b: Derived) => a.row.name.localeCompare(b.row.name, 'ro');
const LAST = '￿';
const SORTS: Record<AthleteListQuery['sort'], (a: Derived, b: Derived) => number> = {
  name: byName,
  age: (a, b) => (a.row.age ?? Infinity) - (b.row.age ?? Infinity) || byName(a, b),
  group: (a, b) => (a.groupName || LAST).localeCompare(b.groupName || LAST, 'ro') || byName(a, b),
};

const byOrder = <T extends { order: number | null; name: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'ro'));

function listOptions(src: ListSource): AthleteListPage['options'] {
  const sections = byOrder(src.sections);
  return {
    sections: [...sections.map((s) => ({ value: s.id, label: s.name })), { value: NO_SECTION, label: NO_SECTION_LABEL }],
    groups: sections.flatMap((s) => byOrder(src.groups.filter((g) => g.active && g.sectionId === s.id)).map((g) => ({ value: g.id, label: g.name, sectionName: s.name }))),
  };
}

export function listAthletes(src: ListSource, q: AthleteListQuery): AthleteListPage {
  const ix = buildIndex(src);
  const all = src.athletes.map((a) => derive(a, ix));
  const listed = all.filter((d) => d.row.status !== 'inactiv');
  const found = all.filter((d) => TESTS.every((t) => t(d, q))).sort(SORTS[q.sort]);
  if (q.dir === 'desc') found.reverse();
  const start = (q.page - 1) * q.pageSize;
  return {
    data: found.slice(start, start + q.pageSize).map((d) => d.row),
    pagination: { page: q.page, pageSize: q.pageSize, total: found.length, pageCount: Math.max(1, Math.ceil(found.length / q.pageSize)) },
    unfiltered: listed.length,
    incomplete: listed.filter((d) => d.row.dataIncomplete).length,
    season: src.season ? { documentId: src.season.id, label: src.season.label } : null,
    seasons: [...src.seasons].sort((a, b) => b.label.localeCompare(a.label)).map((s) => ({ documentId: s.id, label: s.label, isCurrent: s.isCurrent })),
    options: listOptions(src),
  };
}

export async function athleteListPage(store: ClubStore, q: AthleteListQuery, today: DateParts): Promise<AthleteListPage> {
  const [athletes, registrations, memberships, acs, groups, sections, profiles, duplicates, seasons] = await Promise.all([
    store.athletes(), store.registrations(), store.memberships(), store.acsRows(), store.groups(), store.sections(), store.profiles(), store.duplicates(), store.seasons(),
  ]);
  const season = seasons.find((s) => s.id === q.seasonId) ?? seasons.find((s) => s.isCurrent) ?? null;
  return listAthletes({ athletes, registrations, memberships, acs, groups, sections, profiles, duplicates, seasons, season, today }, q);
}
```

In `src/api/club/controllers/athletes.ts` import `athleteListPage, readListQuery` from `'../../../club/athletes/list'` and `todayInBucharest` from `'../../../club/birth-date'`, and add:

```ts
  async list(ctx: AdminCtx) {
    ctx.body = await athleteListPage(clubStore(strapi), readListQuery(ctx.query), todayInBucharest());
  },
```

In `05-athletes.ts`, insert as the FIRST route:

```ts
    { method: 'GET', path: '/club/athletes', handler: 'athletes.list', config: adminGuard },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/list.ts src/club/athletes/__tests__/list.test.ts src/api/club
git commit -m "feat(sportivi): private athlete list with filters, search, sort and paging"
```

---

### Task 21: Athlete record, "Editează", public profile

**Files:**
- Create: `src/club/athletes/record.ts`, `src/club/athletes/profile.ts`
- Modify: `src/api/club/controllers/athletes.ts` (`record`, `update`, `createProfile`, `profileVisibility`, `byProfile`), `src/api/club/routes/05-athletes.ts`
- Test: `src/club/athletes/__tests__/record.test.ts`, `src/club/athletes/__tests__/profile.test.ts`

**Interfaces:**
- Consumes: `readAthleteInput`, `athleteChanges`, `isDataIncomplete`, `isAthleteField`, `missingFields`, `pickAthleteValues`, `birthDateForPicker` (Task 5); `slugify`, `uniqueSlug` (Task 5); `registrationDocumentKinds`, `DOCUMENT_LABELS` (`src/club/registration-panel.ts`); `readHistory` (Task 13); `registrationSeasonLabel` (Task 16); `refreshAllMatches`, `safely`; store and API types.
- Produces:
  - `readAthleteRecord(store, id, seasonId: string | null): Promise<AthleteRecord | null>`; `updateAthlete(ctx, id, body): Promise<AdminResult<AthleteEditResponse>>`
  - `createAthleteProfile(ctx, id): Promise<AdminResult<AthleteRecord>>`; `setAthleteProfileVisibility(ctx, id, body): Promise<AdminResult<AthleteRecord>>`; `athleteIdForProfile(store, profileId): Promise<string | null>`
  - Routes: `GET /api/club/athletes/by-profile/:profileId` → `{ data: { documentId } }` (for the old editor route's redirect, gaps #42); `GET /api/club/athletes/:documentId?season=` → `{ data: AthleteRecord }`; `PUT /api/club/athletes/:documentId` body `{ name, birthDate ('ZZ.LL.AAAA' or ''), contactName, phone, email }` → `{ data: AthleteEditResponse }`; `POST /api/club/athletes/:documentId/profile` → `{ data: AthleteRecord }`; `PUT /api/club/athletes/:documentId/profile/visibility` body `{ on: boolean }` → `{ data: AthleteRecord }`.

- [ ] **Step 1: Write the failing tests**

`src/club/athletes/__tests__/record.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_ERRORS } from '../errors';
import { readAthleteRecord, updateAthlete } from '../record';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const seed = () => ({
  athletes: [
    athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', profileId: 'sp1', contactName: 'Ana', phone: '07' }),
    athleteRow({ id: 'a2', name: 'Pop Maria' }),
  ],
  memberships: [{ id: 'm1', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null }],
  acs: [{ id: 'c1', athleteId: 'a1', seasonId: 's26', state: 'in_asteptare' as const }],
  registrations: [
    registrationRow({ id: 'r1', athleteId: 'a1', number: '2025-0010', seasonId: 's25', season: '2025-2026', membershipAnswer: 'nu', status: 'Confirmat', submittedAt: '2025-10-01T10:00:00.000Z' }),
    registrationRow({ id: 'r2', athleteId: 'a1', status: 'Confirmat' }),
  ],
  profiles: [{ id: 'sp1', name: 'Maria Pop', slug: 'maria-pop', previousSlugs: [], showPublicPage: false, published: true }],
  duplicates: [{ id: 'd1', firstId: 'a2', secondId: 'a1' }],
});

describe('athlete record (spec 6.1 to 6.6)', () => {
  it('Date, header, A.C.S. of the season, Înscrieri, Documente, Profil public, duplicate line, Istoric count', async () => {
    const fake = fakeClubStore(seed());
    await fake.store.record({ subjectType: 'athlete', subjectId: 'a1', action: 'profile-created', actor: 'ana@club.ro' });
    const record = await readAthleteRecord(fake.store, 'a1', null);
    expect(record).toEqual({
      documentId: 'a1',
      fields: { name: 'Maria Pop', birthDate: '14.03.2016', contactName: 'Ana', phone: '07', email: null },
      missing: ['email'],
      status: 'activ',
      dataIncomplete: true,
      header: { birthDate: '14.03.2016', mainGroup: 'Primii Pași' },
      season: { documentId: 's26', label: '2026-2027' },
      acs: { seasonLabel: '2026-2027', state: 'in_asteptare' },
      registrations: [
        { documentId: 'r2', number: '2026-0142', season: '2026-2027', status: 'Confirmat' },
        { documentId: 'r1', number: '2025-0010', season: '2025-2026', status: 'Confirmat' },
      ],
      documents: [
        { registrationDocumentId: 'r2', kind: 'acord', label: 'Acord 2026-2027 (înscrierea 2026-0142)' },
        { registrationDocumentId: 'r2', kind: 'adeziune', label: 'Cerere de adeziune 2026-2027 (înscrierea 2026-0142)' },
        { registrationDocumentId: 'r1', kind: 'acord', label: 'Acord 2025-2026 (înscrierea 2025-0010)' },
      ],
      profile: { documentId: 'sp1', slug: 'maria-pop', showPublicPage: false },
      duplicates: [{ pairId: 'd1', documentId: 'a2', name: 'Pop Maria' }],
      historyCount: 1,
    });
  });

  it('is null for an unknown athlete', async () => expect(await readAthleteRecord(fakeClubStore().store, 'x', null)).toBeNull());
});

describe('Editează on Date (spec 6.2, 3b s2)', () => {
  it('writes old -> new, recomputes "Date incomplete", renames the profile, keeps the slug', async () => {
    const fake = fakeClubStore(seed());
    const result = await updateAthlete(ctx(fake), 'a1', { name: 'Maria Ioana Pop', birthDate: '14.03.2016', contactName: 'Ana', phone: '07', email: 'ana@example.com' });
    expect(result.ok && [result.data.changed, result.data.record.dataIncomplete]).toEqual([['name', 'email'], false]);
    expect(fake.state.profiles[0]).toMatchObject({ name: 'Maria Ioana Pop', slug: 'maria-pop' });
    expect(fake.state.history.map((h) => [h.action, h.changes])).toEqual([
      ['updated', { fields: { name: { from: 'Maria Pop', to: 'Maria Ioana Pop' }, email: { from: null, to: 'ana@example.com' } } }],
    ]);
  });

  it('recomputes a stale "Date incomplete" even with no change, without a history line', async () => {
    const fake = fakeClubStore({ athletes: [athleteRow({ id: 'a1', name: 'Maria', birthDate: '2016-03-14', contactName: 'A', phone: '1', email: 'e', dataIncomplete: true })] });
    const result = await updateAthlete(ctx(fake), 'a1', { name: 'Maria', birthDate: '14.03.2016', contactName: 'A', phone: '1', email: 'e' });
    expect(result.ok && result.data.changed).toEqual([]);
    expect([fake.state.athletes[0].dataIncomplete, fake.state.history]).toEqual([false, []]);
  });

  it('refuses a missing name or a bad date', async () => {
    expect(await updateAthlete(ctx(fakeClubStore(seed())), 'a1', { name: '' })).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.nameRequired });
    expect(await updateAthlete(ctx(fakeClubStore(seed())), 'a1', { name: 'A', birthDate: '2016' })).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.birthDate });
  });

  it('refreshes the saved matches', async () => {
    const fake = fakeClubStore({ athletes: [athleteRow({ id: 'a1', name: 'Ion' })], registrations: [registrationRow({ id: 'r1' })] });
    await updateAthlete(ctx(fake), 'a1', { name: 'Maria Pop', birthDate: '14.03.2016' });
    expect(fake.state.registrations[0]).toMatchObject({ matchAthleteId: 'a1', matchLevel: 'sigur' });
  });
});
```

`src/club/athletes/__tests__/profile.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_ERRORS } from '../errors';
import { athleteIdForProfile, createAthleteProfile, setAthleteProfileVisibility } from '../profile';
import { athleteRow, fakeClubStore, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });

describe('Profil public (spec 6.3)', () => {
  it('"Creează profil public": page off, an unused address, history', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', name: 'Maria Pop' })],
      profiles: [{ id: 'sp9', name: 'Ion', slug: 'ion', previousSlugs: ['maria-pop'], showPublicPage: true, published: true }],
    });
    const result = await createAthleteProfile(ctx(fake), 'a1');
    expect(result.ok && result.data.profile).toEqual({ documentId: expect.any(String), slug: 'maria-pop-2', showPublicPage: false });
    expect(fake.state.history.map((h) => h.action)).toEqual(['profile-created']);
    expect(await createAthleteProfile(ctx(fake), 'a1')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
  });

  it('page on / off: only showPublicPage, logged once per change', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', name: 'Maria', profileId: 'sp1' })],
      profiles: [{ id: 'sp1', name: 'Maria', slug: 'maria', previousSlugs: [], showPublicPage: false, published: true }],
    });
    await setAthleteProfileVisibility(ctx(fake), 'a1', { on: true });
    await setAthleteProfileVisibility(ctx(fake), 'a1', { on: true });
    expect(fake.state.profiles[0].showPublicPage).toBe(true);
    expect(fake.state.history.map((h) => [h.action, h.changes])).toEqual([['profile-page', { on: true }]]);
    expect(await setAthleteProfileVisibility(ctx(fake), 'a1', { on: 'yes' })).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.invalid });
  });

  it('finds the athlete of a profile (old editor route redirect)', async () => {
    const fake = fakeClubStore({ athletes: [athleteRow({ id: 'a1', profileId: 'sp1' })] });
    expect([await athleteIdForProfile(fake.store, 'sp1'), await athleteIdForProfile(fake.store, 'x')]).toEqual(['a1', null]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/athletes/__tests__/record.test.ts src/club/athletes/__tests__/profile.test.ts`
Expected: FAIL with "Cannot find module '../record'" / "'../profile'".

- [ ] **Step 3: Write the implementation**

`src/club/athletes/record.ts`:

```ts
import { refuse, type AdminResult, type FieldChange } from '../admin-result';
import {
  athleteChanges, birthDateForPicker, isAthleteField, isDataIncomplete, missingFields, pickAthleteValues, readAthleteInput, type AthleteValues,
} from '../athlete-data';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { DOCUMENT_LABELS, registrationDocumentKinds } from '../registration-panel';
import type { AthleteEditResponse, AthleteRecord } from './api-types';
import { registrationSeasonLabel } from './cards';
import { ADMIN_ERRORS } from './errors';
import { readHistory } from './history-read';
import { refreshAllMatches, safely } from './matches';
import type { AcsRow, AthleteRow, ClubStore, DuplicateRow, GroupRow, MembershipRow, ProfileRow, RegistrationRow, SeasonRow, ServiceContext } from './store';

/** The athlete record (spec 6): Date | Profil public | Documente | Istoric, read in one call. */
type RecordSource = {
  seasons: SeasonRow[]; groups: GroupRow[]; memberships: MembershipRow[]; acs: AcsRow[]; registrations: RegistrationRow[];
  profiles: ProfileRow[]; duplicates: DuplicateRow[]; athletes: AthleteRow[]; historyCount: number; season: SeasonRow | null;
};

function mainGroupName(src: RecordSource): string | null {
  const main = src.memberships.find((m) => m.seasonId === src.season?.id && m.isMain);
  return src.groups.find((g) => g.id === main?.groupId)?.name ?? null;
}

function registrationRows(src: RecordSource): AthleteRecord['registrations'] {
  return [...src.registrations]
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
    .map((r) => ({ documentId: r.id, number: r.number, season: registrationSeasonLabel(r, src.seasons), status: r.status }));
}

/** "Acord <sezon> (înscrierea <nr>)", "Cerere de adeziune <sezon> (înscrierea <nr>)" (gaps #11). */
function documentRows(src: RecordSource): AthleteRecord['documents'] {
  return registrationRows(src).flatMap((row) => {
    const reg = src.registrations.find((r) => r.id === row.documentId);
    return registrationDocumentKinds({ membershipAnswer: reg?.membershipAnswer }).map((kind) => ({
      registrationDocumentId: row.documentId,
      kind,
      label: `${[DOCUMENT_LABELS[kind], row.season].filter(Boolean).join(' ')} (înscrierea ${row.number ?? ''})`,
    }));
  });
}

function duplicateRows(athleteId: string, src: RecordSource): AthleteRecord['duplicates'] {
  return src.duplicates
    .filter((d) => d.firstId === athleteId || d.secondId === athleteId)
    .flatMap((d) => {
      const other = src.athletes.find((a) => a.id === (d.firstId === athleteId ? d.secondId : d.firstId));
      return other ? [{ pairId: d.id, documentId: other.id, name: other.name ?? '' }] : [];
    });
}

function assemble(a: AthleteRow, src: RecordSource): AthleteRecord {
  const profile = src.profiles.find((p) => p.id === a.profileId);
  const values = pickAthleteValues(a);
  return {
    documentId: a.id,
    fields: { ...values, birthDate: birthDateForPicker(a.birthDate) },
    missing: missingFields(values),
    status: a.status,
    dataIncomplete: a.dataIncomplete,
    header: { birthDate: birthDateForPicker(a.birthDate), mainGroup: mainGroupName(src) },
    season: src.season ? { documentId: src.season.id, label: src.season.label } : null,
    acs: { seasonLabel: src.season?.label ?? null, state: src.acs.find((r) => r.seasonId === src.season?.id)?.state ?? 'nu' },
    registrations: registrationRows(src),
    documents: documentRows(src),
    profile: profile ? { documentId: profile.id, slug: profile.slug, showPublicPage: profile.showPublicPage } : null,
    duplicates: duplicateRows(a.id, src),
    historyCount: src.historyCount,
  };
}

export async function readAthleteRecord(store: ClubStore, id: string, seasonId: string | null): Promise<AthleteRecord | null> {
  const athlete = await store.athlete(id);
  if (!athlete) return null;
  const [seasons, groups, memberships, acs, registrations, profiles, duplicates, athletes, history] = await Promise.all([
    store.seasons(), store.groups(), store.memberships(id), store.acsRows(id), store.registrations({ athleteId: id }),
    store.profiles(), store.duplicates(), store.athletes(), readHistory(store, SUBJECT.athlete, id),
  ]);
  const season = seasons.find((s) => s.id === seasonId) ?? seasons.find((s) => s.isCurrent) ?? null;
  return assemble(athlete, { seasons, groups, memberships, acs, registrations, profiles, duplicates, athletes, historyCount: history.length, season });
}

/** "Date incomplete" is recomputed on every save (3b Q20), even when no field changed. */
async function saveEdit(ctx: ServiceContext, athlete: AthleteRow, values: AthleteValues, changes: Record<string, FieldChange>): Promise<void> {
  const dataIncomplete = isDataIncomplete(values);
  if (Object.keys(changes).length === 0) {
    if (athlete.dataIncomplete !== dataIncomplete) await ctx.store.updateAthlete(athlete.id, { dataIncomplete });
    return;
  }
  await ctx.store.transaction(async () => {
    await ctx.store.updateAthlete(athlete.id, { ...values, dataIncomplete });
    if ('name' in changes && athlete.profileId && values.name) await ctx.store.renameProfile(athlete.profileId, values.name);
    await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: athlete.id, action: HISTORY_ACTIONS.updated, changes: { fields: changes }, actor: ctx.actor });
  });
  await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after an athlete edit');
}

/** PUT /api/club/athletes/:documentId ("Editează" on Date, spec 6.2). A name change renames the profile (3b s2). */
export async function updateAthlete(ctx: ServiceContext, id: string, body: unknown): Promise<AdminResult<AthleteEditResponse>> {
  const input = readAthleteInput(body, 'edit');
  if (input.ok === false) return refuse(400, input.error);
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  const changes = athleteChanges(pickAthleteValues(athlete), input.values);
  await saveEdit(ctx, athlete, input.values, changes);
  const record = await readAthleteRecord(ctx.store, id, null);
  return record ? { ok: true, data: { record, changed: Object.keys(changes).filter(isAthleteField) } } : refuse(404, ADMIN_ERRORS.notFound);
}
```

`src/club/athletes/profile.ts`:

```ts
import { refuse, type AdminResult } from '../admin-result';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { slugify, uniqueSlug } from '../profile-slug';
import type { AthleteRecord } from './api-types';
import { ADMIN_ERRORS } from './errors';
import { readAthleteRecord } from './record';
import type { ClubStore, ServiceContext } from './store';

/** Profil public tab (spec 6.3): create with the page off; switch the page on / off; the editor itself is unchanged. */
async function recordResult(store: ClubStore, id: string): Promise<AdminResult<AthleteRecord>> {
  const record = await readAthleteRecord(store, id, null);
  return record ? { ok: true, data: record } : refuse(404, ADMIN_ERRORS.notFound);
}

export async function createAthleteProfile(ctx: ServiceContext, id: string): Promise<AdminResult<AthleteRecord>> {
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  if (athlete.profileId) return refuse(409, ADMIN_ERRORS.stale);
  const taken = new Set((await ctx.store.profiles()).flatMap((p) => [p.slug, ...p.previousSlugs]));
  const name = athlete.name ?? '';
  await ctx.store.transaction(async () => {
    const profileId = await ctx.store.createProfile(name, uniqueSlug(slugify(name), taken));
    await ctx.store.updateAthlete(id, { profileId });
    await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.profileCreated, actor: ctx.actor });
  });
  return recordResult(ctx.store, id);
}

/** "Pagina publică pornită / oprită": only showPublicPage, as today (3b Q3). */
export async function setAthleteProfileVisibility(ctx: ServiceContext, id: string, body: unknown): Promise<AdminResult<AthleteRecord>> {
  const on = body && typeof body === 'object' ? (body as Record<string, unknown>).on : undefined;
  if (typeof on !== 'boolean') return refuse(400, ADMIN_ERRORS.invalid);
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  const profile = (await ctx.store.profiles()).find((p) => p.id === athlete.profileId);
  if (!profile) return refuse(409, ADMIN_ERRORS.stale);
  if (profile.showPublicPage !== on) {
    await ctx.store.transaction(async () => {
      await ctx.store.setProfileVisibility(profile.id, on);
      await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.profilePage, changes: { on }, actor: ctx.actor });
    });
  }
  return recordResult(ctx.store, id);
}

export async function athleteIdForProfile(store: ClubStore, profileId: string): Promise<string | null> {
  return (await store.athletes()).find((a) => a.profileId === profileId)?.id ?? null;
}
```

In `src/api/club/controllers/athletes.ts` add the imports (`respond`, `serviceContext`, `readAthleteRecord`, `updateAthlete`, `athleteIdForProfile`, `createAthleteProfile`, `setAthleteProfileVisibility`) and the handlers:

```ts
  async byProfile(ctx: AdminCtx) {
    const documentId = await athleteIdForProfile(clubStore(strapi), ctx.params.profileId ?? '');
    if (!documentId) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    ctx.body = { data: { documentId } };
  },

  async record(ctx: AdminCtx) {
    const record = await readAthleteRecord(clubStore(strapi), ctx.params.documentId ?? '', queryText(ctx.query.season) || null);
    if (!record) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    ctx.body = { data: record };
  },

  async update(ctx: AdminCtx) {
    respond(ctx, await updateAthlete(await serviceContext(strapi, ctx), ctx.params.documentId ?? '', ctx.request.body));
  },

  async createProfile(ctx: AdminCtx) {
    respond(ctx, await createAthleteProfile(await serviceContext(strapi, ctx), ctx.params.documentId ?? ''));
  },

  async profileVisibility(ctx: AdminCtx) {
    respond(ctx, await setAthleteProfileVisibility(await serviceContext(strapi, ctx), ctx.params.documentId ?? '', ctx.request.body));
  },
```

In `05-athletes.ts`, insert before the first `/club/athletes/:documentId` path:

```ts
    { method: 'GET', path: '/club/athletes/by-profile/:profileId', handler: 'athletes.byProfile', config: adminGuard },
```

and append after the existing `/:documentId` routes:

```ts
    { method: 'GET', path: '/club/athletes/:documentId', handler: 'athletes.record', config: adminGuard },
    { method: 'PUT', path: '/club/athletes/:documentId', handler: 'athletes.update', config: adminGuard },
    { method: 'POST', path: '/club/athletes/:documentId/profile', handler: 'athletes.createProfile', config: adminGuard },
    { method: 'PUT', path: '/club/athletes/:documentId/profile/visibility', handler: 'athletes.profileVisibility', config: adminGuard },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/record.ts src/club/athletes/profile.ts src/club/athletes/__tests__/record.test.ts src/club/athletes/__tests__/profile.test.ts src/api/club
git commit -m "feat(sportivi): athlete record read and edit, public profile create and visibility"
```

---

### Task 22: "Adaugă sportiv" and "Marchează inactiv / activ"

**Files:**
- Create: `src/club/athletes/add-status.ts`
- Modify: `src/api/club/controllers/athletes.ts` (`add`, `status`), `src/api/club/routes/05-athletes.ts`
- Test: `src/club/athletes/__tests__/add-status.test.ts`

**Interfaces:**
- Consumes: `readAthleteInput`, `athleteChanges`, `isDataIncomplete`, `AthleteValues`, `AthleteStatus` (Task 5); `HISTORY_ACTIONS`, `SUBJECT`; `refreshAllMatches`, `safely`; `ServiceContext`; `ADMIN_ERRORS`.
- Produces:
  - `addAthlete(ctx, body): Promise<AdminResult<{ documentId: string }>>` (status "activ", 3b s10; birth date required, gaps #41)
  - `setAthleteStatus(ctx, id, body): Promise<AdminResult<{ status: AthleteStatus }>>` (body `{ status: 'activ' | 'inactiv' }`)
  - `POST /api/club/athletes` body `{ name, birthDate: 'ZZ.LL.AAAA', contactName?, phone?, email? }` → `{ data: { documentId } }`; `POST /api/club/athletes/:documentId/status` → `{ data: { status } }`.

- [ ] **Step 1: Write the failing test**

`src/club/athletes/__tests__/add-status.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { addAthlete, setAthleteStatus } from '../add-status';
import { ADMIN_ERRORS } from '../errors';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });

describe('Adaugă sportiv (spec 6.7)', () => {
  it('creates an active athlete, "Date incomplete" without the optional fields, matched by waiting registrations', async () => {
    const fake = fakeClubStore({ registrations: [registrationRow({ id: 'r1' })] });
    const result = await addAthlete(ctx(fake), { name: 'Maria Pop', birthDate: '14.03.2016' });
    const created = fake.state.athletes[0];
    expect(result).toEqual({ ok: true, data: { documentId: created.id } });
    expect(created).toMatchObject({ name: 'Maria Pop', birthDate: '2016-03-14', status: 'activ', dataIncomplete: true });
    expect(fake.state.history.map((h) => [h.action, h.changes])).toEqual([
      ['created', { fields: { name: { from: null, to: 'Maria Pop' }, birthDate: { from: null, to: '2016-03-14' } } }],
    ]);
    expect(fake.state.registrations[0]).toMatchObject({ matchAthleteId: created.id, matchLevel: 'sigur' });
  });

  it('needs the name and the birth date', async () => {
    expect(await addAthlete(ctx(fakeClubStore()), { name: 'Maria' })).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.birthDate });
  });
});

describe('Marchează inactiv / activ (spec 6.6)', () => {
  it('changes the status once and logs "Status: Activ → Inactiv"', async () => {
    const fake = fakeClubStore({ athletes: [athleteRow({ id: 'a1' })] });
    expect(await setAthleteStatus(ctx(fake), 'a1', { status: 'inactiv' })).toEqual({ ok: true, data: { status: 'inactiv' } });
    await setAthleteStatus(ctx(fake), 'a1', { status: 'inactiv' });
    expect(fake.state.history.map((h) => [h.action, h.changes])).toEqual([['status-changed', { from: 'activ', to: 'inactiv' }]]);
  });

  it('accepts only activ and inactiv', async () => {
    const fake = fakeClubStore({ athletes: [athleteRow({ id: 'a1' })] });
    expect(await setAthleteStatus(ctx(fake), 'a1', { status: 'nou' })).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.invalid });
    expect(await setAthleteStatus(ctx(fake), 'x', { status: 'activ' })).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/athletes/__tests__/add-status.test.ts`
Expected: FAIL with "Cannot find module '../add-status'".

- [ ] **Step 3: Write the implementation**

`src/club/athletes/add-status.ts`:

```ts
import { refuse, type AdminResult } from '../admin-result';
import { athleteChanges, isDataIncomplete, readAthleteInput, type AthleteStatus, type AthleteValues } from '../athlete-data';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { ADMIN_ERRORS } from './errors';
import { refreshAllMatches, safely } from './matches';
import type { ServiceContext } from './store';

const NONE: AthleteValues = { name: null, birthDate: null, contactName: null, phone: null, email: null };

/** "Adaugă sportiv" after the search found nobody (spec 6.7): created "Activ" (3b s10). */
export async function addAthlete(ctx: ServiceContext, body: unknown): Promise<AdminResult<{ documentId: string }>> {
  const input = readAthleteInput(body, 'add');
  if (input.ok === false) return refuse(400, input.error);
  const { values } = input;
  const documentId = await ctx.store.transaction(async () => {
    const id = await ctx.store.createAthlete({ ...values, status: 'activ', dataIncomplete: isDataIncomplete(values) });
    await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.created, changes: { fields: athleteChanges(NONE, values) }, actor: ctx.actor });
    return id;
  });
  await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after adding an athlete');
  return { ok: true, data: { documentId } };
}

/** "Marchează inactiv" / "Marchează activ" (spec 6.6, gaps #36). */
export async function setAthleteStatus(ctx: ServiceContext, id: string, body: unknown): Promise<AdminResult<{ status: AthleteStatus }>> {
  const to = body && typeof body === 'object' ? (body as Record<string, unknown>).status : undefined;
  if (to !== 'activ' && to !== 'inactiv') return refuse(400, ADMIN_ERRORS.invalid);
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  if (athlete.status !== to) {
    await ctx.store.transaction(async () => {
      await ctx.store.updateAthlete(id, { status: to });
      await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.statusChanged, changes: { from: athlete.status, to }, actor: ctx.actor });
    });
  }
  return { ok: true, data: { status: to } };
}
```

In `src/api/club/controllers/athletes.ts` import `addAthlete, setAthleteStatus` from `'../../../club/athletes/add-status'` and add:

```ts
  async add(ctx: AdminCtx) {
    respond(ctx, await addAthlete(await serviceContext(strapi, ctx), ctx.request.body));
  },

  async status(ctx: AdminCtx) {
    respond(ctx, await setAthleteStatus(await serviceContext(strapi, ctx), ctx.params.documentId ?? '', ctx.request.body));
  },
```

In `05-athletes.ts`, insert right after the `GET /club/athletes` route:

```ts
    { method: 'POST', path: '/club/athletes', handler: 'athletes.add', config: adminGuard },
```

and append:

```ts
    { method: 'POST', path: '/club/athletes/:documentId/status', handler: 'athletes.status', config: adminGuard },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/add-status.ts src/club/athletes/__tests__/add-status.test.ts src/api/club
git commit -m "feat(sportivi): add an athlete, mark inactive or active"
```

---

### Task 23: Delete an athlete

**Files:**
- Create: `src/club/athletes/delete.ts`
- Modify: `src/api/club/controllers/athletes.ts` (`remove`), `src/api/club/routes/05-athletes.ts`
- Test: `src/club/athletes/__tests__/delete.test.ts`

**Interfaces:**
- Consumes: `ServiceContext`, `ClubStore`; `HISTORY_ACTIONS`, `SUBJECT`; `refreshAllMatches`, `safely`; `ADMIN_ERRORS`.
- Produces: `deleteAthlete(ctx, id): Promise<AdminResult<{ documentId: string }>>`; `DELETE /api/club/athletes/:documentId` → `{ data: { documentId } }`, 404, 500 `ADMIN_ERRORS.failed`.

- [ ] **Step 1: Write the failing test**

`src/club/athletes/__tests__/delete.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { deleteAthlete } from '../delete';
import { ADMIN_ERRORS } from '../errors';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';
import type { ConfirmationRecord } from '../../confirm/plan';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const record = { athleteId: 'a1' } as ConfirmationRecord;
const seed = () => ({
  athletes: [athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', profileId: 'sp1' }), athleteRow({ id: 'a2', name: 'Ion Ilie' })],
  registrations: [registrationRow({ id: 'r1', athleteId: 'a1', status: 'Confirmat', confirmation: record })],
  memberships: [{ id: 'm1', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null }],
  acs: [{ id: 'c1', athleteId: 'a1', seasonId: 's26', state: 'da' as const }],
  duplicates: [{ id: 'd1', firstId: 'a1', secondId: 'a2' }],
  profiles: [{ id: 'sp1', name: 'Maria Pop', slug: 'maria-pop', previousSlugs: [], showPublicPage: true, published: true }],
});

describe('Șterge sportivul (spec 6.6, 3b s9)', () => {
  it('unlinks registrations, removes groups, A.C.S., flags and the profile with its results; keeps history for audit', async () => {
    const fake = fakeClubStore(seed());
    expect(await deleteAthlete(ctx(fake), 'a1')).toEqual({ ok: true, data: { documentId: 'a1' } });
    expect(fake.state.registrations[0]).toMatchObject({ athleteId: null, confirmation: null, status: 'Confirmat' });
    expect([fake.state.memberships, fake.state.acs, fake.state.duplicates, fake.state.profiles]).toEqual([[], [], [], []]);
    expect(fake.state.removedParticipations).toEqual(['sp1']);
    expect(fake.state.athletes.map((a) => a.id)).toEqual(['a2']);
    expect(fake.state.history.map((h) => [h.subjectId, h.action, h.changes])).toEqual([['a1', 'deleted', { name: 'Maria Pop' }]]);
  });

  it('the unlinked registration is matched again', async () => {
    const fake = fakeClubStore({ ...seed(), athletes: [...seed().athletes, athleteRow({ id: 'a3', name: 'Maria Pop', birthDate: '2016-03-14' })] });
    await deleteAthlete(ctx(fake), 'a1');
    expect(fake.state.registrations[0]).toMatchObject({ matchAthleteId: 'a3', matchLevel: 'sigur' });
  });

  it('is a 404 for an unknown athlete and rolls back on a failure', async () => {
    expect(await deleteAthlete(ctx(fakeClubStore()), 'x')).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
    const fake = fakeClubStore(seed());
    fake.failOn('deleteProfile');
    expect(await deleteAthlete(ctx(fake), 'a1')).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect([fake.state.athletes.length, fake.state.memberships.length, fake.state.registrations[0].athleteId]).toEqual([2, 1, 'a1']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/athletes/__tests__/delete.test.ts`
Expected: FAIL with "Cannot find module '../delete'".

- [ ] **Step 3: Write the implementation**

`src/club/athletes/delete.ts`:

```ts
import { refuse, type AdminResult } from '../admin-result';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { ADMIN_ERRORS } from './errors';
import { refreshAllMatches, safely } from './matches';
import type { ClubStore, ServiceContext } from './store';

/**
 * "Șterge sportivul" (spec 6.6, 3b s9, gaps #40): always allowed; registrations unlinked (they offer "Confirmă
 * înscrierea" again, N4: their confirmation record is cleared); groups, A.C.S. and duplicate flags removed; the
 * public profile deleted with its competition participations; history kept for audit, shown nowhere.
 */
type Result = AdminResult<{ documentId: string }>;

async function removeOwnRows(store: ClubStore, id: string): Promise<void> {
  for (const r of await store.registrations({ athleteId: id })) await store.updateRegistration(r.id, { athleteId: null, confirmation: null });
  for (const m of await store.memberships(id)) await store.deleteMembership(m.id);
  for (const a of await store.acsRows(id)) await store.deleteAcs(a.id);
  for (const d of await store.duplicates()) if (d.firstId === id || d.secondId === id) await store.deleteDuplicate(d.id);
}

async function deleteInTransaction(ctx: ServiceContext, id: string): Promise<Result> {
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  await removeOwnRows(ctx.store, id);
  if (athlete.profileId) await ctx.store.deleteProfile(athlete.profileId);
  await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.deleted, changes: { name: athlete.name }, actor: ctx.actor });
  await ctx.store.deleteAthlete(id);
  return { ok: true, data: { documentId: id } };
}

export async function deleteAthlete(ctx: ServiceContext, id: string): Promise<Result> {
  let result: Result;
  try {
    result = await ctx.store.transaction(() => deleteInTransaction(ctx, id));
  } catch (err) {
    ctx.log(`[athletes] deleting ${id} failed: ${err instanceof Error ? err.message : String(err)}`);
    return refuse(500, ADMIN_ERRORS.failed);
  }
  if (result.ok === true) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after a delete');
  return result;
}
```

In `src/api/club/controllers/athletes.ts` import `deleteAthlete` from `'../../../club/athletes/delete'` and add:

```ts
  async remove(ctx: AdminCtx) {
    respond(ctx, await deleteAthlete(await serviceContext(strapi, ctx), ctx.params.documentId ?? ''));
  },
```

In `05-athletes.ts` append:

```ts
    { method: 'DELETE', path: '/club/athletes/:documentId', handler: 'athletes.remove', config: adminGuard },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/delete.ts src/club/athletes/__tests__/delete.test.ts src/api/club
git commit -m "feat(sportivi): delete an athlete"
```

---

### Task 24: Merge, "Nu e același copil", and the public lookup of a merged address

**Files:**
- Create: `src/club/athletes/merge.ts`
- Modify: `src/club/profile-slug.ts` (add `previousSlugQuery`, `previousSlugOwner`), `src/api/sportsperson/controllers/sportsperson.ts` (`find`), `src/api/club/controllers/athletes.ts` (`mergePreview`, `merge`, `dismissDuplicate`), `src/api/club/routes/05-athletes.ts`
- Test: `src/club/athletes/__tests__/merge.test.ts`, `src/club/__tests__/profile-slug.test.ts` (append), `src/api/sportsperson/__tests__/previous-slug-wiring.test.ts`

**Interfaces:**
- Consumes: `planMerge`, `mergeDiffering`, `MergeSide`, `MergePlan` (Task 9); `ATHLETE_FIELDS`, `athleteValueText`, `isAthleteField`, `pickAthleteValues`, `AthleteField`; `HISTORY_ACTIONS`, `SUBJECT`, `PENDING_COPY`; `refreshAllMatches`, `safely`; store; `MergePreview`, `MergeSideView`.
- Produces:
  - `readMergeRequest(body: unknown): { keptId: string; removedId: string; take: AthleteField[] } | null`; `mergePreview(store, keptId, removedId): Promise<AdminResult<MergePreview>>`; `mergeAthletes(ctx, request): Promise<AdminResult<{ documentId: string }>>`; `dismissDuplicate(ctx, pairId): Promise<AdminResult<{ pairId: string }>>`
  - `previousSlugQuery(query: Record<string, unknown>): { slug: string; rest: Record<string, unknown> } | null`; `previousSlugOwner(rows: { documentId?: unknown; previousSlugs?: unknown }[], slug: string): string | null`
  - Routes: `GET /api/club/athletes/merge-preview?kept=&removed=` → `{ data: MergePreview }`; `POST /api/club/athletes/merge` body `{ keptId, removedId, take: AthleteField[] }` → `{ data: { documentId } }`; `POST /api/club/athlete-duplicates/:pairId/dismiss` → `{ data: { pairId } }`.
  - Public: `GET /api/sportspeople?filters[previousSlugs][$contains]=<slug>&<populate>` → the usual collection answer with the one published profile that remembers the slug (its current `slug`), or `{ data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } }`; `previousSlugs` never in the output (private).

- [ ] **Step 1: Write the failing tests**

`src/club/athletes/__tests__/merge.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_ERRORS } from '../errors';
import { dismissDuplicate, mergeAthletes, mergePreview, readMergeRequest } from '../merge';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';
import type { ConfirmationRecord } from '../../confirm/plan';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const profile = (id: string, slug: string, previousSlugs: string[] = []) => ({ id, name: 'x', slug, previousSlugs, showPublicPage: true, published: true });
const seed = () => ({
  athletes: [
    athleteRow({ id: 'k', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0722', profileId: 'sp-k' }),
    athleteRow({ id: 'r', name: 'Pop Maria', birthDate: null, phone: '0733', email: 'ana@example.com', profileId: 'sp-r' }),
    athleteRow({ id: 't', name: 'Maria P.' }),
  ],
  registrations: [registrationRow({ id: 'reg', athleteId: 'r', status: 'Confirmat', confirmation: { athleteId: 'r' } as ConfirmationRecord })],
  memberships: [
    { id: 'mk', athleteId: 'k', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null },
    { id: 'mr', athleteId: 'r', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null },
    { id: 'mr2', athleteId: 'r', groupId: 'g-ib', seasonId: 's25', isMain: true, from: null },
  ],
  acs: [{ id: 'ck', athleteId: 'k', seasonId: 's26', state: 'in_asteptare' as const }, { id: 'cr', athleteId: 'r', seasonId: 's26', state: 'da' as const }],
  duplicates: [{ id: 'd1', firstId: 'k', secondId: 'r' }, { id: 'd2', firstId: 'r', secondId: 't' }],
  profiles: [profile('sp-k', 'maria-pop'), profile('sp-r', 'maria-pop-2', ['m-pop'])],
});

describe('Unește cu alt sportiv (spec 6.6, d39)', () => {
  it('preview: both records and the differing fields', async () => {
    const result = await mergePreview(fakeClubStore(seed()).store, 'k', 'r');
    expect(result.ok && result.data.differing).toEqual(['name', 'birthDate', 'phone', 'email']);
    expect(result.ok && [result.data.kept.profileSlug, result.data.removed.registrations]).toEqual(['maria-pop', 1]);
  });

  it('moves everything to the kept record with the picked fields', async () => {
    const fake = fakeClubStore(seed());
    expect(await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: ['email'] })).toEqual({ ok: true, data: { documentId: 'k' } });
    expect(fake.state.athletes.map((a) => a.id)).toEqual(['k', 't']);
    expect(fake.state.athletes[0]).toMatchObject({ name: 'Maria Pop', phone: '0722', email: 'ana@example.com' });
    expect(fake.state.registrations[0]).toMatchObject({ athleteId: 'k', confirmation: null });
    expect(fake.state.memberships.map((m) => [m.id, m.athleteId, m.isMain])).toEqual([['mk', 'k', true], ['mr2', 'k', true]]);
    expect(fake.state.acs.map((a) => [a.id, a.athleteId, a.state])).toEqual([['ck', 'k', 'da']]);
  });

  it('keeps the kept profile, deletes the other and remembers its addresses (d39)', async () => {
    const fake = fakeClubStore(seed());
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: [] });
    expect(fake.state.profiles).toEqual([{ ...profile('sp-k', 'maria-pop', ['maria-pop-2', 'm-pop']), name: 'Maria Pop' }]);
    expect(fake.state.removedParticipations).toEqual(['sp-r']);
  });

  it('only the other record has a profile: it moves to the kept record and follows its name', async () => {
    const fake = fakeClubStore({ ...seed(), athletes: [athleteRow({ id: 'k', name: 'Maria Pop' }), athleteRow({ id: 'r', name: 'Pop Maria', profileId: 'sp-r' })] });
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: [] });
    expect(fake.state.athletes[0].profileId).toBe('sp-r');
    expect(fake.state.profiles.find((p) => p.id === 'sp-r')).toMatchObject({ name: 'Maria Pop', slug: 'maria-pop-2' });
  });

  it('flags: the pair goes, a flag with a third athlete moves to the kept record (N5)', async () => {
    const fake = fakeClubStore(seed());
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: [] });
    expect(fake.state.duplicates.map((d) => [d.firstId, d.secondId])).toEqual([['k', 't']]);
  });

  it('history moves to the kept record, then "Unit cu <nume>"', async () => {
    const fake = fakeClubStore(seed());
    await fake.store.record({ subjectType: 'athlete', subjectId: 'r', action: 'created-from-registrations', actor: 'migrare' });
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: ['email'] });
    expect(fake.state.history.map((h) => [h.subjectId, h.action])).toEqual([['k', 'created-from-registrations'], ['k', 'merged'], ['k', 'updated']]);
    expect(fake.state.history[1].changes).toEqual({ name: 'Pop Maria' });
  });

  it('reads the body; refuses the same record twice and unknown records', async () => {
    expect(readMergeRequest({ keptId: 'k', removedId: 'r', take: ['email', 'x'] })).toEqual({ keptId: 'k', removedId: 'r', take: ['email'] });
    expect(readMergeRequest({ keptId: 'k', removedId: 'k' })).toBeNull();
    expect(await mergeAthletes(ctx(fakeClubStore(seed())), { keptId: 'k', removedId: 'zz', take: [] })).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
  });
});

describe('Nu e același copil (d12)', () => {
  it('removes the flag for good and notes it on both records', async () => {
    const fake = fakeClubStore(seed());
    expect(await dismissDuplicate(ctx(fake), 'd1')).toEqual({ ok: true, data: { pairId: 'd1' } });
    expect(fake.state.duplicates.map((d) => d.id)).toEqual(['d2']);
    expect(fake.state.history.map((h) => [h.subjectId, h.action, h.changes])).toEqual([
      ['k', 'duplicate-dismissed', { name: 'Pop Maria' }],
      ['r', 'duplicate-dismissed', { name: 'Maria Pop' }],
    ]);
    expect(await dismissDuplicate(ctx(fake), 'd1')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
  });
});
```

Append to `src/club/__tests__/profile-slug.test.ts` (and add `previousSlugOwner, previousSlugQuery` to its import):

```ts
describe('a merged-away address (d39, plan 3-3 Task 6)', () => {
  it('reads filters[previousSlugs][$contains] and drops that filter', () => {
    expect(previousSlugQuery({ filters: { previousSlugs: { $contains: ' maria-pop-2 ' } }, populate: { photo: true } })).toEqual({
      slug: 'maria-pop-2', rest: { populate: { photo: true } },
    });
    expect(previousSlugQuery({ filters: { slug: { $eq: 'x' } } })).toBeNull();
    expect(previousSlugQuery({})).toBeNull();
  });

  it('finds the profile that remembers exactly that address', () => {
    const rows = [{ documentId: 'a', previousSlugs: ['maria-pop-22'] }, { documentId: 'b', previousSlugs: ['maria-pop-2'] }, { documentId: 'c', previousSlugs: null }];
    expect(previousSlugOwner(rows, 'maria-pop-2')).toBe('b');
    expect(previousSlugOwner(rows, 'maria')).toBeNull();
  });
});
```

`src/api/sportsperson/__tests__/previous-slug-wiring.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const controller = readFileSync(join(__dirname, '..', 'controllers/sportsperson.ts'), 'utf8');

it('the public list answers a merged-away address with the published profile that remembers it', () => {
  const find = controller.slice(controller.indexOf('async find('), controller.indexOf('async publishOne('));
  expect(find).toContain('previousSlugQuery(');
  expect(find).toContain("where: { publishedAt: { $notNull: true } }");
  expect(find.match(/super\.find\(ctx\)/g)).toHaveLength(2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/athletes/__tests__/merge.test.ts src/club/__tests__/profile-slug.test.ts src/api/sportsperson`
Expected: FAIL ("Cannot find module '../merge'", missing exports, no `find`).

- [ ] **Step 3: Write the implementation**

Append to `src/club/profile-slug.ts`:

```ts
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The website's lookup of a merged-away address: `filters[previousSlugs][$contains]=<slug>` (plan 3-3 Task 6). */
export function previousSlugQuery(query: Record<string, unknown>): { slug: string; rest: Record<string, unknown> } | null {
  const filters = isRecord(query.filters) ? query.filters : null;
  const condition = filters && isRecord(filters.previousSlugs) ? filters.previousSlugs : null;
  const slug = condition && typeof condition.$contains === 'string' ? condition.$contains.trim() : '';
  if (!slug) return null;
  const rest = { ...query };
  delete rest.filters;
  return { slug, rest };
}

/** Exact match on one remembered address (never a substring of another). */
export function previousSlugOwner(rows: { documentId?: unknown; previousSlugs?: unknown }[], slug: string): string | null {
  const hit = rows.find((r) => Array.isArray(r.previousSlugs) && r.previousSlugs.includes(slug));
  return hit && typeof hit.documentId === 'string' ? hit.documentId : null;
}
```

In `src/api/sportsperson/controllers/sportsperson.ts` add `import { previousSlugOwner, previousSlugQuery } from '../../../club/profile-slug';` and, as the first method of the returned object (before `publishOne`):

```ts
  /**
   * GET /api/sportspeople. `filters[previousSlugs][$contains]=<slug>` (the website, for an address removed by a merge,
   * d39) answers the published profile that remembers the slug. `previousSlugs` is private: matched here, never output.
   */
  async find(ctx) {
    const wanted = previousSlugQuery((ctx.query ?? {}) as Record<string, unknown>);
    if (!wanted) return super.find(ctx);
    const rows = await strapi.db.query(UID).findMany({ select: ['documentId', 'previousSlugs'], where: { publishedAt: { $notNull: true } }, limit: 5000 });
    const documentId = previousSlugOwner(rows, wanted.slug);
    if (!documentId) return { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } };
    ctx.query = { ...wanted.rest, filters: { documentId } };
    return super.find(ctx);
  },
```

`src/club/athletes/merge.ts`:

```ts
import { refuse, type AdminResult } from '../admin-result';
import { ATHLETE_FIELDS, athleteValueText, isAthleteField, pickAthleteValues, type AthleteField } from '../athlete-data';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import type { MergePreview, MergeSideView } from './api-types';
import { ADMIN_ERRORS } from './errors';
import { refreshAllMatches, safely } from './matches';
import { mergeDiffering, planMerge, type MergePlan, type MergeSide } from './merge-plan';
import type { AthleteRow, ClubStore, ProfileRow, RegistrationRow, ServiceContext } from './store';

/** "Unește cu alt sportiv" (spec 6.6, d39) and "Nu e același copil" (d12). No undo. */
export type MergeRequest = { keptId: string; removedId: string; take: AthleteField[] };
type Result = AdminResult<{ documentId: string }>;

const idOf = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function readMergeRequest(body: unknown): MergeRequest | null {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const keptId = idOf(b.keptId);
  const removedId = idOf(b.removedId);
  const take = Array.isArray(b.take) ? b.take.filter(isAthleteField) : [];
  return keptId && removedId && keptId !== removedId ? { keptId, removedId, take } : null;
}

function sideView(a: AthleteRow, profiles: ProfileRow[], registrations: RegistrationRow[]): MergeSideView {
  const fields = Object.fromEntries(ATHLETE_FIELDS.map((f) => [f, athleteValueText(f, a[f])])) as Record<AthleteField, string>;
  const profileSlug = profiles.find((p) => p.id === a.profileId)?.slug ?? null;
  return { documentId: a.id, name: a.name ?? '', fields, status: a.status, profileSlug, registrations: registrations.filter((r) => r.athleteId === a.id).length };
}

export async function mergePreview(store: ClubStore, keptId: string, removedId: string): Promise<AdminResult<MergePreview>> {
  if (!keptId || keptId === removedId) return refuse(400, ADMIN_ERRORS.invalid);
  const [kept, removed, profiles, registrations] = await Promise.all([store.athlete(keptId), store.athlete(removedId), store.profiles(), store.registrations()]);
  if (!kept || !removed) return refuse(404, ADMIN_ERRORS.notFound);
  const differing = mergeDiffering(pickAthleteValues(kept), pickAthleteValues(removed));
  return { ok: true, data: { kept: sideView(kept, profiles, registrations), removed: sideView(removed, profiles, registrations), differing } };
}

async function loadSide(store: ClubStore, athleteId: string, profiles: ProfileRow[]): Promise<MergeSide | null> {
  const athlete = await store.athlete(athleteId);
  if (!athlete) return null;
  const [memberships, acs] = await Promise.all([store.memberships(athleteId), store.acsRows(athleteId)]);
  const profile = profiles.find((p) => p.id === athlete.profileId);
  return {
    id: athlete.id, name: athlete.name ?? '', values: pickAthleteValues(athlete), status: athlete.status,
    profile: profile ? { id: profile.id, slug: profile.slug, previousSlugs: profile.previousSlugs } : null,
    memberships: memberships.map(({ id: mId, groupId, seasonId, isMain }) => ({ id: mId, groupId, seasonId, isMain })),
    acs: acs.map(({ id: aId, seasonId, state }) => ({ id: aId, seasonId, state })),
  };
}

async function applyRows(store: ClubStore, plan: MergePlan, keptId: string, removedId: string): Promise<void> {
  for (const r of await store.registrations({ athleteId: removedId })) await store.updateRegistration(r.id, { athleteId: keptId, confirmation: null });
  for (const m of plan.memberships.move) await store.updateMembership(m.id, { athleteId: keptId, isMain: m.isMain });
  for (const mId of plan.memberships.remove) await store.deleteMembership(mId);
  for (const aId of plan.acs.move) await store.updateAcs(aId, { athleteId: keptId });
  for (const r of plan.acs.raise) await store.updateAcs(r.id, { state: r.state });
  for (const aId of plan.acs.remove) await store.deleteAcs(aId);
}

/** N5 (option A): the pair goes; a flag with a third athlete moves to the kept one, never twice, never with itself. */
export async function repointDuplicates(store: ClubStore, removedId: string, keptId: string): Promise<void> {
  const pairs = await store.duplicates();
  const other = (p: { firstId: string; secondId: string }, of: string) => (p.firstId === of ? p.secondId : p.firstId);
  const partners = new Set(pairs.filter((p) => p.firstId === keptId || p.secondId === keptId).map((p) => other(p, keptId)));
  for (const pair of pairs.filter((p) => p.firstId === removedId || p.secondId === removedId)) {
    const partner = other(pair, removedId);
    await store.deleteDuplicate(pair.id);
    if (partner !== keptId && !partners.has(partner)) {
      await store.createDuplicate(keptId, partner);
      partners.add(partner);
    }
  }
}

async function applyProfile(store: ClubStore, plan: MergePlan, keptId: string, removedId: string): Promise<void> {
  const p = plan.profile;
  if (p.moveId || p.deleteId) await store.updateAthlete(removedId, { profileId: null });
  if (p.moveId) await store.updateAthlete(keptId, { profileId: p.moveId });
  if (p.deleteId) await store.deleteProfile(p.deleteId);
  if (p.finalId && p.previousSlugs) await store.setPreviousSlugs(p.finalId, p.previousSlugs);
  if (p.finalId && plan.values.name) await store.renameProfile(p.finalId, plan.values.name);
}

async function applyMerge(ctx: ServiceContext, kept: MergeSide, removed: MergeSide, plan: MergePlan): Promise<void> {
  await applyRows(ctx.store, plan, kept.id, removed.id);
  await repointDuplicates(ctx.store, removed.id, kept.id);
  await applyProfile(ctx.store, plan, kept.id, removed.id);
  await ctx.store.updateAthlete(kept.id, { ...plan.values, dataIncomplete: plan.dataIncomplete });
  await ctx.store.moveHistory(removed.id, kept.id);
  await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: kept.id, action: HISTORY_ACTIONS.merged, changes: { name: removed.name }, actor: ctx.actor });
  if (Object.keys(plan.fieldChanges).length) {
    await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: kept.id, action: HISTORY_ACTIONS.updated, changes: { fields: plan.fieldChanges }, actor: ctx.actor });
  }
  await ctx.store.deleteAthlete(removed.id);
}

async function mergeInTransaction(ctx: ServiceContext, request: MergeRequest): Promise<Result> {
  const profiles = await ctx.store.profiles();
  const [kept, removed] = await Promise.all([loadSide(ctx.store, request.keptId, profiles), loadSide(ctx.store, request.removedId, profiles)]);
  if (!kept || !removed) return refuse(404, ADMIN_ERRORS.notFound);
  await applyMerge(ctx, kept, removed, planMerge(kept, removed, request.take));
  return { ok: true, data: { documentId: kept.id } };
}

export async function mergeAthletes(ctx: ServiceContext, request: MergeRequest): Promise<Result> {
  let result: Result;
  try {
    result = await ctx.store.transaction(() => mergeInTransaction(ctx, request));
  } catch (err) {
    ctx.log(`[athletes] merging ${request.removedId} into ${request.keptId} failed: ${err instanceof Error ? err.message : String(err)}`);
    return refuse(500, ADMIN_ERRORS.failed);
  }
  if (result.ok === true) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after a merge');
  return result;
}

/** "Nu e același copil": the flag goes for good (d12); both records note it (N2 b). */
export async function dismissDuplicate(ctx: ServiceContext, pairId: string): Promise<AdminResult<{ pairId: string }>> {
  const pair = (await ctx.store.duplicates()).find((d) => d.id === pairId);
  if (!pair) return refuse(409, ADMIN_ERRORS.stale);
  const [first, second] = await Promise.all([ctx.store.athlete(pair.firstId), ctx.store.athlete(pair.secondId)]);
  const note = (subjectId: string, name: string | null | undefined) =>
    ctx.store.record({ subjectType: SUBJECT.athlete, subjectId, action: HISTORY_ACTIONS.duplicateDismissed, changes: { name: name ?? '' }, actor: ctx.actor });
  await ctx.store.transaction(async () => {
    await ctx.store.deleteDuplicate(pair.id);
    await note(pair.firstId, second?.name);
    await note(pair.secondId, first?.name);
  });
  return { ok: true, data: { pairId } };
}
```

In `src/api/club/controllers/athletes.ts` import `dismissDuplicate, mergeAthletes, mergePreview, readMergeRequest` from `'../../../club/athletes/merge'` and add:

```ts
  async mergePreview(ctx: AdminCtx) {
    respond(ctx, await mergePreview(clubStore(strapi), queryText(ctx.query.kept), queryText(ctx.query.removed)));
  },

  async merge(ctx: AdminCtx) {
    const request = readMergeRequest(ctx.request.body);
    if (!request) return refuseWith(ctx, 400, ADMIN_ERRORS.invalid);
    respond(ctx, await mergeAthletes(await serviceContext(strapi, ctx), request));
  },

  async dismissDuplicate(ctx: AdminCtx) {
    respond(ctx, await dismissDuplicate(await serviceContext(strapi, ctx), ctx.params.pairId ?? ''));
  },
```

In `05-athletes.ts`, insert before the first `/club/athletes/:documentId` path:

```ts
    { method: 'GET', path: '/club/athletes/merge-preview', handler: 'athletes.mergePreview', config: adminGuard },
    { method: 'POST', path: '/club/athletes/merge', handler: 'athletes.merge', config: adminGuard },
    { method: 'POST', path: '/club/athlete-duplicates/:pairId/dismiss', handler: 'athletes.dismissDuplicate', config: adminGuard },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club src/api && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/athletes/merge.ts src/club/athletes/__tests__/merge.test.ts src/club/profile-slug.ts src/club/__tests__/profile-slug.test.ts src/api/sportsperson src/api/club
git commit -m "feat(sportivi): merge two athletes, dismiss a possible duplicate, public lookup of a merged address"
```

---
### Task 25: Dashboard tile "Sportivi" counts active athletes

**Files:**
- Modify: `src/api/club/controllers/club.ts` (`summary`)
- Modify: `src/admin/dashboard/DashboardPage.tsx:266-297` (the KPI effect)
- Test: `src/club/__tests__/club-summary.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `GET /api/club/summary` answers `{ data: { seasons, sections, groups, athletes, activeAthletes, priceLists, numberedRegistrations } }`; the dashboard tile "Sportivi" shows `activeAthletes` (spec 7, 3b s12).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/club-summary.test.ts`:

```ts
import { afterEach, expect, it, vi } from 'vitest';
import club from '../../api/club/controllers/club';

afterEach(() => {
  delete (globalThis as { strapi?: unknown }).strapi;
});

it('counts the active athletes for the dashboard tile "Sportivi" (spec 7)', async () => {
  const count = vi.fn(async (args: { filters?: Record<string, unknown> }) => (args.filters?.status === 'activ' ? 7 : 1));
  (globalThis as { strapi?: unknown }).strapi = { documents: () => ({ count }) };
  const ctx: { body: unknown } = { body: null };
  await club.summary(ctx);
  expect(ctx.body).toMatchObject({ data: { athletes: 1, activeAthletes: 7 } });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/club-summary.test.ts`
Expected: FAIL (`activeAthletes` missing).

- [ ] **Step 3: Write the implementation**

In `src/api/club/controllers/club.ts`, `summary` becomes:

```ts
  async summary(ctx) {
    const count = (uid: UID.ContentType, filters?: Record<string, unknown>) =>
      strapi.documents(uid).count(filters ? { filters } : {});
    const [seasons, sections, groups, athletes, activeAthletes, priceLists, numberedRegistrations] = await Promise.all([
      count('api::season.season'),
      count('api::section.section'),
      count('api::group.group'),
      count('api::athlete.athlete'),
      count('api::athlete.athlete', { status: 'activ' }),
      count('api::price-list.price-list'),
      count('api::registration-submission.registration-submission', { registrationNumber: { $notNull: true } }),
    ]);
    ctx.body = { data: { seasons, sections, groups, athletes, activeAthletes, priceLists, numberedRegistrations } };
  },
```

In `src/admin/dashboard/DashboardPage.tsx`, inside the KPI effect, add next to `count`:

```ts
    const activeAthletes = async (): Promise<number | null> => {
      try {
        const r = (await get('/api/club/summary')) as { data?: { data?: { activeAthletes?: unknown } } };
        const v = r?.data?.data?.activeAthletes;
        return typeof v === 'number' ? v : null;
      } catch { return null; }
    };
```

and in the `Promise.all([...])` replace `count('api::sportsperson.sportsperson'),` with `activeAthletes(),`. The tile label stays "Sportivi".

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/club && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json`
Expected: PASS, zero type errors in both.

- [ ] **Step 5: Commit**

```bash
git add src/api/club/controllers/club.ts src/admin/dashboard/DashboardPage.tsx src/club/__tests__/club-summary.test.ts
git commit -m "feat(dashboard): Sportivi tile counts active athletes"
```

---

### Task 26: Deploy script for steps 7 to 12

**Files:**
- Create: `scripts/migrate-athletes-registrations.js`
- Modify: `package.json` (`scripts`: `"migrate:athletes": "node scripts/migrate-athletes-registrations.js"`)

**Interfaces:**
- Consumes (compiled, from `dist/src/club/`): `deploy/name-migration`, `migrate/plan` (`planAthletes`), `deploy/past-registrations`, `athletes/matches` (`planMatchUpdates`), `deploy/duplicate-flags`, `deploy/deploy-status`, `athletes/strapi-store` (`strapiClubStore`), `history-text`, `season`, `birth-date`.
- Produces: `node scripts/migrate-athletes-registrations.js --step=<step> [--apply]` with `<step>` one of `athlete-name` (spec 11 step 7), `profile-athletes` (8), `past-registrations` (9), `match-backfill` (10), `duplicates` (11), `status` (12). Dry run by default; every step idempotent and re-runnable; one small transaction per created athlete at most, never one big transaction. Actor `migrare` on every history row.

This is plain JavaScript like the other migration scripts (no unit test of its own); its planners are unit tested in Tasks 10 and 12, and Task 27 runs every step dry, apply, apply again on a throwaway Postgres.

- [ ] **Step 1: Write the script**

`scripts/migrate-athletes-registrations.js`:

```js
'use strict';
/**
 * Phase 3A+3B deploy data (spec 11, steps 7 to 12). One step per run, in this order:
 *   athlete-name, profile-athletes, past-registrations, match-backfill, duplicates, status
 * Dry run by default; pass --apply to write. Each step is idempotent and re-runnable; no big transaction.
 * Usage: node scripts/migrate-athletes-registrations.js --step=<step> [--apply]
 * Needs the compiled code (npm run build): planners are read from dist/src/club.
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');
const STEP = (process.argv.find((a) => a.startsWith('--step=')) || '').slice('--step='.length);
const ACTOR = 'migrare';
const ATHLETE = 'api::athlete.athlete';

const log = (...a) => console.log(APPLY ? '[apply]' : '[dry-run]', ...a);
const lib = (p) => require(`../dist/src/club/${p}`);

async function stepAthleteName({ app }) {
  const { planNameMigration } = lib('deploy/name-migration');
  const rows = await app.db.query(ATHLETE).findMany({
    select: ['documentId', 'name', 'firstName', 'lastName'],
    populate: { publicProfile: { select: ['name'] } },
    limit: 100000,
  });
  const plan = planNameMigration(rows.map((r) => ({
    id: r.documentId, name: r.name || null, firstName: r.firstName || null, lastName: r.lastName || null, profileName: r.publicProfile ? r.publicProfile.name : null,
  })));
  log('athlete names to write:', plan.updates.length, 'without first/last name:', plan.empty.length);
  plan.profileMismatches.forEach((m) => log(`  differs from the public profile: "${m.name}" (profile "${m.profileName}")`));
  if (!APPLY) return;
  for (const u of plan.updates) await app.documents(ATHLETE).update({ documentId: u.id, data: { name: u.name } });
}

async function stepProfileAthletes({ app, store }) {
  const { planAthletes } = lib('migrate/plan');
  const { HISTORY_ACTIONS, SUBJECT } = lib('history-text');
  const profiles = await app.db.query('api::sportsperson.sportsperson').findMany({ select: ['documentId', 'name'], limit: 5000 });
  const unique = [...new Map(profiles.map((p) => [p.documentId, p])).values()];
  const athletes = await store.athletes();
  const plan = planAthletes({ sportspeople: unique, linkedProfileIds: athletes.map((a) => a.profileId).filter(Boolean) });
  log('athletes to create for public profiles:', plan.create.length);
  for (const a of plan.create) {
    log('  athlete', a.name);
    if (!APPLY) continue;
    await store.transaction(async () => {
      const id = await store.createAthlete({ name: a.name, dataIncomplete: true, profileId: a.publicProfileId });
      await store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.createdFromProfile, actor: ACTOR, changes: { publicProfile: a.publicProfileId } });
    });
  }
}

function pastRows(registrations, seasons) {
  const { normalizeSeasonLabel } = lib('season');
  const labelOf = new Map(seasons.map((s) => [s.id, s.label]));
  return registrations.map((r) => ({
    id: r.id, number: r.number, childName: r.childName, childBirthDate: r.childBirthDate, parentName: r.parentName, phone: r.phone, email: r.email,
    status: r.status, seasonLabel: labelOf.get(r.seasonId) || normalizeSeasonLabel(r.season), submittedAt: r.submittedAt,
  }));
}

async function stepPastRegistrations({ store }) {
  const { planPastRegistrationAthletes } = lib('deploy/past-registrations');
  const { HISTORY_ACTIONS, SUBJECT } = lib('history-text');
  const [registrations, seasons, done] = await Promise.all([store.registrations(), store.seasons(), store.historyByAction(HISTORY_ACTIONS.createdFromRegistrations)]);
  const current = seasons.find((s) => s.isCurrent);
  if (!current) throw new Error('no current Sezon: mark one current before this step');
  const covered = new Set(done.flatMap((h) => (Array.isArray(h.changes.registrations) ? h.changes.registrations : []).map((r) => r.documentId)));
  const plan = planPastRegistrationAthletes(pastRows(registrations, seasons), current.label, covered);
  log('athletes to create from past registrations:', plan.create.length, 'skipped:', JSON.stringify(plan.skipped));
  for (const a of plan.create) {
    log('  athlete', a.values.name, a.values.birthDate || '(no readable birth date)', `${a.registrations.length} registration(s)`);
    if (!APPLY) continue;
    await store.transaction(async () => {
      const id = await store.createAthlete({ ...a.values, dataIncomplete: true });
      await store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.createdFromRegistrations, actor: ACTOR, changes: { registrations: a.registrations } });
    });
  }
}

async function stepMatchBackfill({ store }) {
  const { planMatchUpdates } = lib('athletes/matches');
  const { parseBirthDate } = lib('birth-date');
  const [registrations, athletes] = await Promise.all([store.registrations(), store.athletes()]);
  if (athletes.some((a) => !a.name)) throw new Error('athletes without a name: run --step=athlete-name first');
  const updates = planMatchUpdates(registrations, athletes);
  const levels = {};
  for (const u of updates) levels[u.patch.matchLevel || 'none'] = (levels[u.patch.matchLevel || 'none'] || 0) + 1;
  const unreadable = registrations.filter((r) => !parseBirthDate(r.childBirthDate)).length;
  log('registrations to update:', updates.length, 'by level:', JSON.stringify(levels), 'unreadable birth dates:', unreadable);
  if (!APPLY) return;
  for (const u of updates) await store.updateRegistration(u.registrationId, u.patch);
}

async function stepDuplicates({ store }) {
  const { planDuplicateFlags } = lib('deploy/duplicate-flags');
  const [athletes, existing] = await Promise.all([store.athletes(), store.duplicates()]);
  const names = new Map(athletes.map((a) => [a.id, a.name]));
  const facts = athletes.map((a) => ({ id: a.id, name: a.name || '', birthDate: a.birthDate, phone: a.phone, email: a.email }));
  const pairs = planDuplicateFlags(facts, existing);
  log('possible duplicate pairs to flag:', pairs.length);
  pairs.forEach((p) => log(`  ${names.get(p.firstId)} / ${names.get(p.secondId)} (${p.level})`));
  if (!APPLY) return;
  for (const p of pairs) await store.createDuplicate(p.firstId, p.secondId);
}

async function stepStatus({ store }) {
  const { planDeployStatus } = lib('deploy/deploy-status');
  const { HISTORY_ACTIONS, SUBJECT } = lib('history-text');
  const { normalizeSeasonLabel } = lib('season');
  const [athletes, registrations, seasons, profiles] = await Promise.all([store.athletes(), store.registrations(), store.seasons(), store.profiles()]);
  const current = seasons.find((s) => s.isCurrent);
  if (!current) throw new Error('no current Sezon: mark one current before this step');
  const inCurrent = registrations.filter((r) => r.seasonId === current.id || normalizeSeasonLabel(r.season) === current.label);
  const changes = planDeployStatus(athletes, inCurrent, new Set(profiles.filter((p) => p.showPublicPage).map((p) => p.id)));
  log('status changes:', changes.length, 'to Inactiv:', changes.filter((c) => c.to === 'inactiv').length, 'to Activ:', changes.filter((c) => c.to === 'activ').length);
  if (!APPLY) return;
  for (const c of changes) {
    await store.transaction(async () => {
      await store.updateAthlete(c.id, { status: c.to });
      await store.record({ subjectType: SUBJECT.athlete, subjectId: c.id, action: HISTORY_ACTIONS.statusChanged, actor: ACTOR, changes: { from: c.from, to: c.to } });
    });
  }
}

const STEPS = {
  'athlete-name': stepAthleteName,
  'profile-athletes': stepProfileAthletes,
  'past-registrations': stepPastRegistrations,
  'match-backfill': stepMatchBackfill,
  duplicates: stepDuplicates,
  status: stepStatus,
};

async function main() {
  const step = STEPS[STEP];
  if (!step) {
    console.error(`--step must be one of: ${Object.keys(STEPS).join(', ')}`);
    process.exit(2);
  }
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  try {
    await step({ app, store: lib('athletes/strapi-store').strapiClubStore(app) });
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

In `package.json` add after `"migrate:registration"`:

```json
    "migrate:athletes": "node scripts/migrate-athletes-registrations.js",
```

- [ ] **Step 2: Check it parses and refuses an unknown step**

Run: `node --check scripts/migrate-athletes-registrations.js && node scripts/migrate-athletes-registrations.js --step=nope; echo "exit $?"`
Expected: no syntax error; `--step must be one of: athlete-name, profile-athletes, past-registrations, match-backfill, duplicates, status` and `exit 2` (it exits before loading Strapi).

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-athletes-registrations.js package.json
git commit -m "feat(club): deploy script for the athlete name, profiles, past registrations, matching, duplicates and status"
```

The production runbook order is spec 11: after the phase 2 copy script and its admin checks (steps 5 and 6), run `--step=athlete-name`, `profile-athletes`, `past-registrations`, `match-backfill`, `duplicates`, `status`, each first without and then with `--apply`, the user approving each step; then deploy the frontend and reopen "Înscrieri deschise".

---

### Task 27: Boot check on a throwaway Postgres

**Files:** none in the repo. Temporary files live in `${TMPDIR:-/tmp}/es32` and are removed at the end.

**Interfaces:**
- Consumes: everything above. Proves on a real Strapi 5 and Postgres what the fake store cannot: the schema (columns kept, new types), the transaction and row lock (two parallel confirmations, a forced failure rolled back), relation filters of the Înscrieri list, the profile name written on both rows without publishing, `previousSlugs` private and found by the public read, and every deploy step dry, apply, apply again.

Notes: the Google Sheets lifecycle is inert (no connected sheet). If port 55432 is taken, pick another and change it in both places. Start Strapi in the background and poll `/_health`.

- [ ] **Step 1: Postgres, environment, build, fixture**

```bash
cd /Users/codrin/Documents/Programming/edusport_backend
T="${TMPDIR:-/tmp}/es32"; mkdir -p "$T"
cat > "$T/env" <<'EOF'
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55432
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
HOST=127.0.0.1
PORT=1338
APP_KEYS=throwawayA,throwawayB
API_TOKEN_SALT=throwaway
ADMIN_JWT_SECRET=throwaway
TRANSFER_TOKEN_SALT=throwaway
JWT_SECRET=throwaway
ENCRYPTION_KEY=throwaway
STRAPI_TELEMETRY_DISABLED=true
EOF
docker run -d --name es32-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi -p 127.0.0.1:55432:5432 postgres:16
until docker exec es32-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
cat > "$T/fixture.js" <<'EOF'
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  await d('api::site-settings.site-settings').create({ data: { registration: { open: true } } });
  const s25 = await d('api::season.season').create({ data: { label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31', isCurrent: false } });
  const s26 = await d('api::season.season').create({ data: { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true } });
  const school = await d('api::section.section').create({ data: { name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', slug: 'afi-cotroceni', publicPage: true, order: 1 } });
  const club = await d('api::section.section').create({ data: { name: 'Club', kind: 'club', slug: 'club', order: 2 } });
  await d('api::group.group').create({ data: { name: 'Primii Pași', section: school.documentId, order: 1 } });
  await d('api::group.group').create({ data: { name: 'Profesioniști', section: club.documentId, order: 1 } });
  const p1 = await d('api::sportsperson.sportsperson').create({ data: { name: 'Maria Dumitrescu', slug: 'maria-dumitrescu', showPublicPage: true }, status: 'published' });
  await d('api::sportsperson.sportsperson').create({ data: { name: 'Ioana Marinescu', slug: 'ioana-marinescu', showPublicPage: false } });
  await d('api::athlete.athlete').create({ data: { firstName: 'Maria', lastName: 'Dumitrescu', dataIncomplete: true, publicProfile: p1.documentId } });
  const reg = (n, season, extra) => d('api::registration-submission.registration-submission').create({ data: {
    registrationNumber: n, season: season.label, seasonRef: season.documentId, section: school.documentId, status: 'Nou', archived: false,
    email: 'parinte@example.com', phone: '0722000001', parentName: 'Ion Stoica', shirtSize: 'S', membershipAnswer: 'da',
    submittedAt: '2025-10-01T10:00:00.000Z', ...extra } });
  await reg('2025-0001', s25, { childName: 'Luca Stoica', childBirthDate: '01.02.2015' });
  await reg('2025-0002', s25, { childName: 'Stoica Luca', childBirthDate: '01/02/2015', phone: '0722000009', submittedAt: '2025-10-05T10:00:00.000Z' });
  await reg('2025-0003', s25, { childName: 'Andrei Pop', childBirthDate: '03.03.2014', status: 'Respins' });
  await reg('2025-0004', s25, { childName: 'Ana Ilie', childBirthDate: 'ieri' });
  await reg('2025-0005', s25, { childName: 'Maria Dumitrescu', childBirthDate: '14 martie 2016', email: 'ana.d@example.com', phone: '0733000001' });
  await reg('2026-0001', s26, { childName: 'Maria Dumitrescu', childBirthDate: '14.03.2016', email: 'ana.d@example.com', phone: '0733000001', parentName: 'Ana Dumitrescu', submittedAt: '2026-10-03T11:22:00.000Z' });
  await reg('2026-0002', s26, { childName: 'Luca Stoica', childBirthDate: '01.02.2015', email: 'alt@example.com', submittedAt: '2026-10-04T09:00:00.000Z' });
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
EOF
(set -a; . "$T/env"; set +a; cp "$T/fixture.js" ./es32-fixture.js && node ./es32-fixture.js; rm ./es32-fixture.js)
docker exec es32-pg psql -U strapi -d strapi -tAc "select column_name from information_schema.columns where table_name='athletes' and column_name in ('name','first_name','last_name') order by 1"
```

Expected: the build finishes; the fixture exits 0; the columns `first_name`, `last_name`, `name` are listed.

- [ ] **Step 2: Every deploy step dry, apply, apply again**

```bash
step() { (set -a; . "$T/env"; set +a; node scripts/migrate-athletes-registrations.js --step="$1" $2); }
for s in athlete-name profile-athletes past-registrations match-backfill duplicates status; do
  echo "== $s"; step "$s"; step "$s" --apply; step "$s" --apply
done 2>&1 | tee "$T/steps.log"
```

Expected in `$T/steps.log`, per step (dry run, first apply, second apply):
- `athlete-name`: `athlete names to write: 1 without first/last name: 0` twice, then `athlete names to write: 0`; no "differs from the public profile" line.
- `profile-athletes`: `athletes to create for public profiles: 1` (Ioana Marinescu) twice, then `0`.
- `past-registrations`: `athletes to create from past registrations: 3 skipped: {"covered":0,"respins":1,"noSeason":0,"currentOrLater":2}` with lines `Ana Ilie (no readable birth date) 1 registration(s)`, `Maria Dumitrescu 2016-03-14 1 registration(s)`, `Stoica Luca 2015-02-01 2 registration(s)`; the second apply: `athletes to create from past registrations: 0 skipped: {"covered":4,"respins":1,"noSeason":0,"currentOrLater":2}`.
- `match-backfill`: `registrations to update: 7 by level: {"sigur":5,"probabil":1,"none":1} unreadable birth dates: 1`, then `registrations to update: 0`.
- `duplicates`: `possible duplicate pairs to flag: 1` with `Maria Dumitrescu / Maria Dumitrescu (probabil)`, then `0`.
- `status`: `status changes: 2 to Inactiv: 2 to Activ: 0`, then `status changes: 0 ...`.

- [ ] **Step 3: Start Strapi, an admin and a read-only API token**

```bash
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1338/_health | grep -q 204; do sleep 2; done
API=http://127.0.0.1:1338/api
json() { node -pe "const v=JSON.parse(require('fs').readFileSync(0,'utf8')); $1"; }
TOKEN=$(curl -s -X POST http://127.0.0.1:1338/admin/register-admin -H 'Content-Type: application/json' \
  -d '{"firstname":"Ana","lastname":"Test","email":"ana@example.com","password":"Throwaway123"}' | json 'v.data.token')
AUTH="Authorization: Bearer $TOKEN"
PUBLIC=$(curl -s -X POST http://127.0.0.1:1338/admin/api-tokens -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"es32","type":"read-only","lifespan":null}' | json 'v.data.accessKey')
q() { docker exec es32-pg psql -U strapi -d strapi -tAc "$1"; }
R1=$(q "select document_id from registration_submissions where registration_number='2026-0001'")
A=$(q "select document_id from athletes where name='Maria Dumitrescu' and birth_date is not null")
A1=$(q "select document_id from athletes where name='Maria Dumitrescu' and birth_date is null")
G=$(q "select document_id from club_groups where name='Primii Pași'")
echo "$R1 $A $A1 $G"
```

Expected: four non-empty documentIds.

- [ ] **Step 4: Înscrieri list, match, two confirmations at once, undo**

```bash
curl -s "$API/forms/inscrieri?season=2026-2027&existing=da&sort=age-asc" -H "$AUTH" | json 'v.data.map(r=>[r.registrationNumber,r.age,r.existingAthlete,r.athleteId,"confirmation" in r]).join(" | ")+" | schools="+v.schools.length+" multiple="+v.multipleSchools'
curl -s "$API/club/registrations/$R1/match" -H "$AUTH" | json '[v.data.preselect, v.data.existing.documentId, v.data.candidates.map(c=>c.documentId).join(",")].join(" ")'
BODY="{\"choice\":\"existing\",\"athleteId\":\"$A\",\"groupId\":\"$G\"}"
for i in 1 2; do curl -s -o "$T/c$i.json" -w '%{http_code}\n' -X POST "$API/club/registrations/$R1/confirm" -H "$AUTH" -H 'Content-Type: application/json' -d "$BODY" & done; wait
cat "$T/c1.json" "$T/c2.json"; echo
q "select count(*) from group_memberships"; q "select count(*), min(state) from acs_memberships"
curl -s -X POST "$API/club/registrations/$R1/undo-confirmation" -H "$AUTH" | json 'JSON.stringify(v.data)'
curl -s "$API/club/registrations/$R1/match" -H "$AUTH" | json '[v.data.confirmed, v.data.existing.documentId].join(" ")'
q "select count(*) from group_memberships"; q "select count(*) from acs_memberships"
curl -s "$API/club/registrations/$R1/history" -H "$AUTH" | json 'v.data.map(l=>l.text).join(" | ")'
```

Expected:
- the list (age ascending, both unconfirmed with a saved match, no internal field sent): `2026-0001,10,true,,false | 2026-0002,11,true,,false | schools=1 multiple=false`;
- match: `existing <A> <A1>` (Sigur preselected, the profile athlete as the other candidate);
- the two parallel confirmations print `200` and `409` in some order; one body is `{"data":{"athleteId":"<A>","athleteName":"Maria Dumitrescu",...}}`, the other carries `"message":"Înscrierea a fost deja confirmată de alt administrator."`; then `1` group membership and `1|in_asteptare`;
- undo: `{"status":"Nou","athleteDeleted":false}`; match again `false <A>`; `0` and `0` rows;
- history, newest first: `Confirmare anulată | Confirmat. Fișa existentă folosită (Maria Dumitrescu); grupa Primii Pași. | Înscriere înregistrată`.

- [ ] **Step 5: A failing write leaves nothing (all or nothing)**

```bash
BEFORE="$(q 'select count(*) from athletes') $(q 'select count(*) from history_entries')"
q "alter table group_memberships add constraint es32_boom check (false) not valid"
curl -s -w ' %{http_code}\n' -X POST "$API/club/registrations/$R1/confirm" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"choice\":\"new\",\"groupId\":\"$G\"}"
q "alter table group_memberships drop constraint es32_boom"
AFTER="$(q 'select count(*) from athletes') $(q 'select count(*) from history_entries')"
echo "$BEFORE -> $AFTER"
curl -s "$API/club/registrations/$R1/match" -H "$AUTH" | json 'v.data.confirmed'
```

Expected: a body with `"message":"Confirmarea nu a reușit. Nimic nu a fost salvat."` and ` 500`; the two counts unchanged (`5 N -> 5 N`); `false`.

- [ ] **Step 6: Sportivi list, profile name on both rows, merge, the public lookup, delete, dashboard**

```bash
curl -s "$API/club/athletes" -H "$AUTH" | json '[v.pagination.total, v.unfiltered, v.incomplete].join(" ")'
curl -s "$API/club/athletes?status=inactiv" -H "$AUTH" | json 'v.pagination.total'
curl -s "$API/club/athletes?duplicates=true" -H "$AUTH" | json 'v.data.map(r=>r.documentId).sort().join(",")'; echo "$A,$A1" | tr ',' '\n' | sort | paste -sd, -
P1=$(q "select distinct document_id from sportspeople where slug='maria-dumitrescu'")
curl -s -X PUT "$API/club/athletes/$A1" -H "$AUTH" -H 'Content-Type: application/json' -d '{"name":"Maria Elena Dumitrescu","birthDate":""}' | json 'v.data.changed.join(",")'
q "select name, slug, published_at is not null from sportspeople where document_id='$P1' order by 3"
P2=$(curl -s -X POST "$API/club/athletes/$A/profile" -H "$AUTH" | json 'v.data.profile.documentId')
q "select distinct slug from sportspeople where document_id='$P2'"
curl -s -X POST "$API/club/athletes/merge" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"keptId\":\"$A\",\"removedId\":\"$A1\",\"take\":[]}" | json 'v.data.documentId'
q "select count(*) from sportspeople where document_id='$P1'"
curl -s -X PUT "http://127.0.0.1:1338/content-manager/collection-types/api::sportsperson.sportsperson/$P2" -H "$AUTH" -H 'Content-Type: application/json' -d '{"description":"Text"}' -o /dev/null -w '%{http_code}\n'
q "select previous_slugs::text from sportspeople where document_id='$P2' order by published_at nulls first"
curl -s "$API/sportspeople?filters%5BpreviousSlugs%5D%5B%24contains%5D=maria-dumitrescu" -H "Authorization: Bearer $PUBLIC" | json 'v.data.map(p=>p.slug).join(",")'
curl -s "$API/sportspeople" -H "Authorization: Bearer $PUBLIC" | grep -c previousSlugs
curl -s "$API/sportspeople?filters%5BpreviousSlugs%5D%5B%24contains%5D=nimic" -H "Authorization: Bearer $PUBLIC" | json 'v.data.length'
L=$(q "select document_id from athletes where name='Stoica Luca'")
curl -s -X DELETE "$API/club/athletes/$L" -H "$AUTH" | json 'v.data.documentId'
curl -s "$API/club/athletes/$L/history" -H "$AUTH" -o /dev/null -w '%{http_code}\n'
q "select count(*) from history_entries where subject_id='$L' and action='deleted'"
curl -s "$API/club/summary" -H "$AUTH" | json 'v.data.activeAthletes'; q "select count(*) from athletes where status='activ'"
```

Expected, line by line:
- `3 3 2`: Maria (from past registrations), Luca and the profile athlete are listed; Luca and the profile athlete are incomplete (Maria's flag was recomputed by the confirmation and its undo in Step 4); then `2` inactive (Ioana, Ana Ilie);
- the possible-duplicates filter prints the same two ids as the line after it (A and A1);
- the edit answers `name`; both profile rows (draft `f`, published `t`) read `Maria Elena Dumitrescu|maria-dumitrescu|...`: renamed in place, nothing published, the slug unchanged;
- the new profile of A has the slug `maria-dumitrescu-2` (the old address is taken); the merge answers `<A>`; the merged-away profile is gone (`0` rows);
- the content-manager save answers `200`, and both rows of the kept profile still read `["maria-dumitrescu"]` (an editor save does not wipe `previousSlugs`);
- the public lookup of the old address answers `maria-dumitrescu-2`; `0` occurrences of `previousSlugs` in the public JSON; an unknown old address answers `0` rows;
- the delete answers `<L>`; its history route `404`; `1` "deleted" history row kept for audit;
- `activeAthletes` prints `1` and the SQL count prints `1` (only the kept Maria is Activ: Luca is deleted, the profile athlete was merged away, Ioana and Ana Ilie are Inactiv).

- [ ] **Step 7: Clean up**

```bash
kill "$(cat "$T/pid")"
docker rm -f es32-pg
rm -rf "$T"
git status --short
```

Expected: the container is gone and `git status` shows no stray files (the fixture was copied and removed).

---
## Interfaces for other plans

Everything below exists once this plan is merged on `feat/athletes`. The admin UI plans (Înscrieri, Sportivi, shared UI) and the website plan 3-3 build against it and change nothing here.

### Conventions

- Admin routes are content-api routes under `/api`, called with the admin fetch client (it attaches the admin Bearer token); every one has `{ auth: false, policies: ['global::is-admin'] }`.
- Success: HTTP 200 and `{ data: <shape> }`, except `GET /api/club/athletes` and `GET /api/forms/inscrieri`, whose body is the page itself (`{ data: rows, pagination, ... }`), like today's Înscrieri list.
- Refusal: `{ data: null, error: { status, name: 'ClubAdminError', message } }` (`respond` / `refuseWith` in `src/club/admin-http.ts`); `requestErrorText(err, fallback)` in `src/club/registration-panel.ts` reads `message`. The PUT of a registration keeps Strapi's own `ctx.badRequest` / `ctx.notFound` shape, as today.
- Texts: `CONFIRM_ERRORS` (spec 4.7) and `ADMIN_ERRORS` (plan item N1) in `src/club/athletes/errors.ts`.
- Dates: athlete dates go out as `ZZ.LL.AAAA` (`birthDate` fields) and come in as `ZZ.LL.AAAA` or `''`; registration `childBirthDate` stays free text; timestamps are ISO.

### Routes

| Method and path | Request | Success `data` | Refusals |
|---|---|---|---|
| GET `/api/forms/inscrieri` | today's params + `existing=da\|nu`, `school=<section documentId>`, `sort=newest\|oldest\|name\|age-asc\|age-desc` | today's page; each row also `age: number\|null`, `existingAthlete: boolean`, `athleteId`, `athleteName`, `canUndo: boolean`, `schoolId`, `schoolName` (no `confirmation`, `matchAthlete`, `matchLevel`, `submissionKey`, `athlete`, `section`, `childBirthDateParsed`); top level also `schools: { documentId, name, count }[]`, `multipleSchools: boolean`, `allSchoolsTotal: number` | as today |
| PUT `/api/forms/inscrieri/:documentId` | any of `EDITABLE_FIELDS` (`src/club/registration-update.ts`), now with `childHeight`, `lastSeason` | `{ data: registration, rebuild?: RebuildResult, changed: string[] }`; `changed: []` = "Nicio modificare."; `rebuild.ok === false` = "Salvat. Documentul PDF nu a putut fi refăcut." | 400 "Stare invalidă." (incl. `status: 'Confirmat'`), 400 "Valoare invalidă.", 404 |
| DELETE `/api/forms/inscrieri/:documentId` | | as today; a confirmed one also writes "Înscriere ștearsă: <nr>" on the athlete | as today |
| POST `/api/club/registrations/move-school` | `{ documentIds: string[], sectionId }` | `MoveSchoolResponse` `{ moved, skipped }` | 400 `ADMIN_ERRORS.invalid` (fewer than 2 schools, not a school, bad body) |
| GET `/api/club/registrations/:documentId/history` | | `HistoryLine[]` `{ at, actor, text }`, newest first | 404 |
| GET `/api/club/registrations/:documentId/match` | | `RegistrationMatchView` | 404 |
| GET `/api/club/registrations/:documentId/confirm-context` | `?athlete=<athlete documentId>` (omit for "Sportiv nou") | `ConfirmContext` | 404 |
| POST `/api/club/registrations/:documentId/confirm` | `ConfirmRequest` `{ choice: 'existing'\|'new', athleteId?, groupId?: string\|null, makeMain?: boolean, updateFields?: AthleteField[] }` (omit `updateFields` = default ticks) | `ConfirmResponse` `{ athleteId, athleteName, registrationId }` (toast "Înscriere confirmată: <athleteName>") | 409 `CONFIRM_ERRORS.taken`; 400 `CONFIRM_ERRORS.birthDate`; 400 / 500 `CONFIRM_ERRORS.failed`; 404 |
| POST `/api/club/registrations/:documentId/undo-confirmation` | | `UndoResponse` `{ status, athleteDeleted }` | 409 `ADMIN_ERRORS.stale`; 500 `ADMIN_ERRORS.failed`; 404 |
| POST `/api/club/registrations/:documentId/move-school` | `{ sectionId }` | `MoveSchoolResponse` | 409 `ADMIN_ERRORS.stale` (confirmed, already there, gone); 400 `ADMIN_ERRORS.invalid` |
| GET `/api/club/athletes` | `season`, `q`, `status`, `section` (`none` = Fără secțiune), `group`, `noGroup=true`, `acs`, `profile=public\|ascuns`, `data=complete\|incomplete`, `duplicates=true`, `sort=name\|age\|group`, `dir=asc\|desc`, `page`, `pageSize=50\|30`; lists comma-separated | `AthleteListPage` (body itself) | none |
| POST `/api/club/athletes` | `{ name, birthDate: 'ZZ.LL.AAAA', contactName?, phone?, email? }` | `{ documentId }` | 400 `ADMIN_ERRORS.nameRequired` / `.birthDate` |
| GET `/api/club/athletes/search` | `q`, `registration=<registration documentId>` (confirm window) | `AthleteCard[]` (max 20; without `q`: the registration's candidates, proposed first) | none |
| GET `/api/club/athletes/merge-preview` | `kept`, `removed` (athlete documentIds) | `MergePreview` | 400 `ADMIN_ERRORS.invalid`; 404 |
| POST `/api/club/athletes/merge` | `{ keptId, removedId, take: AthleteField[] }` (fields whose value comes from the removed record) | `{ documentId }` (the kept record) | 400 `ADMIN_ERRORS.invalid`; 404; 500 `ADMIN_ERRORS.failed` |
| GET `/api/club/athletes/by-profile/:profileId` | sportsperson documentId (old editor route `/plugins/edusport-sportiv-edit` redirect) | `{ documentId }` | 404 |
| POST `/api/club/athlete-duplicates/:pairId/dismiss` | | `{ pairId }` ("Nu e același copil") | 409 `ADMIN_ERRORS.stale` |
| GET `/api/club/athletes/:documentId` | `?season=<season documentId>` (default current) | `AthleteRecord` | 404 (also for a deleted athlete) |
| PUT `/api/club/athletes/:documentId` | `{ name, birthDate: 'ZZ.LL.AAAA'\|'', contactName, phone, email }` | `AthleteEditResponse` `{ record, changed: AthleteField[] }` (toasts from `record.missing` / `missingText`) | 400 `ADMIN_ERRORS.nameRequired` / `.birthDate`; 404 |
| DELETE `/api/club/athletes/:documentId` | | `{ documentId }` | 404; 500 `ADMIN_ERRORS.failed` |
| POST `/api/club/athletes/:documentId/status` | `{ status: 'activ'\|'inactiv' }` | `{ status }` | 400 `ADMIN_ERRORS.invalid`; 404 |
| GET `/api/club/athletes/:documentId/history` | | `HistoryLine[]` | 404 |
| POST `/api/club/athletes/:documentId/profile` | | `AthleteRecord` (with `profile`, page off) | 409 `ADMIN_ERRORS.stale` (already has one); 404 |
| PUT `/api/club/athletes/:documentId/profile/visibility` | `{ on: boolean }` | `AthleteRecord` (writes "Pagina publică pornită / oprită"; the Profil public tab's visibility control should call this so the line is written) | 400 `ADMIN_ERRORS.invalid`; 409 `ADMIN_ERRORS.stale` (no profile); 404 |
| GET `/api/club/summary` | | today's counts + `activeAthletes` | |
| GET `/api/sportspeople?filters[previousSlugs][$contains]=<slug>&<populate>` (public, API token as today) | | the usual collection answer: the published profile that remembers `<slug>`, with its current `slug`; else `data: []` | |

Registration documents keep their phase 2 route `GET /api/club/registrations/:documentId/documents/:kind` (`kind` = `acord` \| `adeziune`); `AthleteRecord.documents` gives `registrationDocumentId` and `kind` for it.

### JSON shapes (`src/club/athletes/api-types.ts`)

`AthleteCard`, `RegistrationMatchView`, `GroupOption`, `GroupSection`, `ConfirmContext`, `ConfirmResponse`, `UndoResponse`, `MoveSchoolResponse`, `HistoryLine`, `AthleteListRow`, `AthleteListPage`, `AthleteRecord`, `AthleteEditResponse`, `MergeSideView`, `MergePreview`, exactly as written in Task 11. `ComparisonRow` is in `src/club/confirm/compare.ts`; `ConfirmRequest` and `RegistrationStatus` in `src/club/confirm/plan.ts`.

### Pure helpers the UI can import from `src/club`

- `birth-date.ts`: `parseBirthDate`, `readPickedDate`, `roDate`, `isoDate`, `partsFromIso`, `ageOn`, `ageFromText`, `ageFromIso`, `todayInBucharest`, `birthYearRange`, `birthYearOptions` (ascending; a stored year outside the range stays selectable) for the zi / lună / an picker of Editează and the record.
- `athlete-data.ts`: `ATHLETE_FIELDS`, `ATHLETE_FIELD_LABELS` ("Nume și prenume", "Data nașterii", "Persoana de contact", "Telefon", "E-mail"), `MISSING_FIELD_WORDS`, `missingText` (for "Lipsesc: <câmpuri>", "Salvat. Mai lipsesc: <câmpuri>."), `isDataIncomplete`, `AthleteStatus`, `AthleteField`, `AthleteValues`.
- `acs.ts`: `ACS_WORDS`, `acsWord` ("Da" / "Nu" / "În așteptare"), `ACS_RANK`.
- `history-text.ts`: `STATUS_WORDS` ("Nou" / "Activ" / "Inactiv"), `REGISTRATION_FIELD_LABELS`, `ARROW`.
- `confirm/compare.ts`: `COMPARE_LABELS`; `confirm/season.ts`: `seasonEndedText`; `confirm/plan.ts`: `canConfirm`, `canUndo`.
- `matching.ts`, `person-match.ts`: never needed by the UI (the server matches and searches).

### Notes for the UI plans

- `AthleteListRow.missing` can be empty while `dataIncomplete` is true: records made at deploy are marked "Date incomplete" (spec 2.3) until their next save recomputes the flag.
- The Profil public tab's own editor (today's `SportivEditPage.tsx`) keeps saving through the Content Manager; the name there is read-only. It never needs `previousSlugs`.
- Website plan 3-3 Task 6 (Option A) works unchanged against the public lookup above: `fetchSportspersonBySlug` falls back to `filters[previousSlugs][$contains]`, compares the returned `slug` and answers `permanentRedirect` (308).

---

## Self-review

**1. Spec coverage**

- 1.1 one full name, migration readable first/last, `planAthletes` / `splitPersonName`, no Calitate, "Date incomplete" recompute, duplicate flag storage: Tasks 1, 5, 10, 21, 22.
- 1.2 profile keeps its table, name follows the athlete without touching draft edits, slug never changes, merged address redirects: Tasks 11 (`renameProfile` on both rows), 17, 21, 24; storage per the coordinator's decision.
- 1.3 `athlete` set / removed / moved, match saved, statuses, school move keeps number and subscription, birth date formats, no copy after confirmation, `submissionKey` repeats not matched twice: Tasks 1, 2, 12 (hook skips repeats), 14, 17, 18, 19, 23, 24.
- 1.4 group membership and A.C.S. written at confirmation (season running, `from`, main group, never lowered, nothing twice, no subscription): Task 7, 17.
- 1.5 statuses, reactivation, "Sportiv nou" activ, Adaugă sportiv activ, inactive / active actions, deploy rule: Tasks 7, 10, 22, 26.
- 1.6 every history line, read route, actor by name, Migrare, deleted athlete history kept and hidden: Tasks 6, 13, and every writer.
- 2.1 levels, normalising, several candidates, line only while unconfirmed, inactive included, never auto-merge: Tasks 3, 4, 12, 15, 16.
- 2.2 at submit, on edit, after any athlete change, at deploy: Tasks 12, 14, 17, 18, 21 to 24, 26.
- 2.3 deploy data (past seasons only, Respins skipped, grouping, newest contact, unreadable dates, unlinked, re-run profile athletes, backfill, duplicates, status after backfill): Tasks 10, 26, 27.
- 3.1 / 3.2 server side (Vârstă, "Sportiv existent" filter and line, school tabs data, cell edits old -> new, Confirmat refused): Tasks 14, 15. 3.4 Editează server side (all answers, wish, picker format, rebuild and "Document refăcut", match refresh): Task 14. 3.5 status rules: Tasks 7, 14. 3.6 school move: Task 19.
- 4.5 to 4.7 what confirming writes, undo, errors, concurrency, all or nothing, unreadable date block, Respins / archived: Tasks 7, 8, 17, 18, 27.
- 6.6 inactive / active, duplicates line and dismissal, delete, merge with field choice and profile redirect; 6.7 add with search: Tasks 16, 20 to 24.
- 7 dashboard count: Task 25. 11 deploy steps 7 to 12 as dry-run / `--apply` scripts: Tasks 10, 26, 27.
- Out of this plan (other plans): every admin screen, Select / Radio / BottomSheet / Toast action, the menu section and the old editor route redirect (this plan gives `by-profile`), the website birth date picker and the website redirect (plan 3-3), diagrams (spec 10).

**2. Placeholder scan:** no TBD or "similar to Task N"; every code step carries the code; the copy that waits on a decision is real text in one named constant (N1 `ADMIN_ERRORS`, N2 `PENDING_COPY`).

**3. Type consistency:** `ClubStore` method names and row types are defined once in Task 11 and used verbatim in Tasks 12 to 26 (`registrations({ athleteId })`, `memberships(athleteId?)`, `acsRows(athleteId?)`, `setPreviousSlugs`, `moveHistory`); `ConfirmRequest`, `ConfirmationRecord`, `ConfirmFacts`, `ConfirmPlan` come from Task 7 only; `HISTORY_ACTIONS` names in writers match the renderer table of Task 6; route handler names match the route files (checked by `athlete-routes.test.ts`).

**4. Review Focus:** each of the five lines at the top has its test: concurrency (Task 17 test + Task 27 Step 4), rollback (Task 17 `failOn` + Task 27 Step 5), undo after later edits (Task 18 and Task 8 tests), re-runnable deploy steps (Task 10 `covered` test + Task 27 Step 2), profile name on both rows and the private merged address (Tasks 21 and 24 tests + Task 27 Step 6).
