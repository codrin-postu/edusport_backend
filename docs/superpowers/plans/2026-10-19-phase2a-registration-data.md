# Phase 2A: Registration Data, Numbering and Public Read Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every new registration its season, school and number at submit, store the script form's answers, and serve one public, read-only endpoint with the current season, membership fee and public prices, plus a one-time copy of tooltips and notes from the old pricing data.

**Architecture:** Rules live in `src/club/` as small TypeScript modules with Vitest tests (pure functions; Strapi only through a typed `Core.Strapi` argument in thin loaders). The submit endpoint becomes a thin controller over `submitRegistration(body, slug, deps)`, whose dependencies (form-config checks, season, schools, prices, numbering) are injected, so the whole flow is unit tested with fakes. Numbering is a pure "next number" function plus a retry loop around a database unique index. The copy script follows `scripts/migrate-club-foundation.js`: dry run by default, `--apply`, idempotent, planners compiled from `dist/src/club/migrate/`.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS, `strict: false`), Postgres in production, Vitest 3, Node 22.

**Validated:** the code in this plan was applied to a scratch copy of the repo on 2026-10-19: Vitest 205 tests passed, `tsc --noEmit` zero errors after type generation, and the Task 11 outputs below were observed on a throwaway Postgres (container removed).

**Spec:** `docs/superpowers/specs/2026-10-19-registration-rebuild-design.md`, sections 1.1-1.6 and 3.1. Decisions log: `../edusport_frontend/docs/portal/DECISIONS.md` (a dated decision wins over the spec). Phase 1 conventions: `docs/superpowers/plans/2026-10-19-club-data-foundation.md`.

**Amendments to the spec (coordinator, 2026-10-19), applied in this plan:**
- Option lists confirmed from the live script form (Task 2).
- Spec 1.4 completeness rule replaced: an item is offered to members when it has `memberPrice`, to non-members when it has `nonMemberPrice`; it is incomplete only when BOTH are missing (Task 3).
- Registration targets (user, 2026-10-19): one global "Înscrieri deschise" switch (`site-settings.registration.open`), enforced by the backend; a school is a section with `kind = 'school'` and `publicPage = true`; the per-section `registrationsOpen` is not used yet; Club is never a registration target and never appears in the public read, even with a public page (Tasks 4, 6, 9).
- Extra CMS-added questions are removed from the registration form (user, 2026-10-03), and cannot come back (cross-plan review I2): the public config of `inscriere` never returns custom questions, and the submit neither validates nor stores `extra` (Tasks 2, 9). The copy script also deletes the stored custom questions of the `inscriere` form config; stored `extra` answers of old registrations stay (Tasks 8, 10).
- `showPublic` dropped (user, 2026-10-19): no list visibility switch. The website and the form show every price list of the school, filtered per audience by `offeredItems(items, audience)`; items with both prices missing are hidden everywhere and flagged incomplete (Tasks 3, 6).

## Global Constraints

- TypeScript in `src/`; functions < 30 lines; cyclomatic complexity < 10; no `any` (for Strapi UIDs use `UID.ContentType` from `'@strapi/strapi'`; for the Strapi instance `Core.Strapi`).
- Single quotes in `src/` (match the surrounding code).
- Tests: `npm test` (Vitest) and `npx tsc --noEmit` with zero errors, after every task.
- Data shapes passed to Strapi JSON attributes are `type` aliases, never `interface` (an interface is not assignable to Strapi's `JSONValue`).
- New content types (none in 2A) keep `pluginOptions.content-manager.visible: false` and `createCoreRouter(..., { only: [] })`.
- Admin routes use the `global::is-admin` policy; public routes use `{ auth: false, policies: [], middlewares: [] }` like `src/api/registration-submission/routes/01-public.ts`.
- Copy rules for user-visible text: no em dash, no middle dot, no emoji; terse; UI copy in Romanian, code and docs in English. Romanian letters ș and ț use the comma below, never the cedilla (ş, ţ).
- Commits: Conventional Commits, no AI attribution, no `Co-Authored-By`. Never push. Never run anything against production.
- Boot checks use a throwaway local Postgres container (port 55432, Strapi on 1338; 1337 is taken), never the user's local DB; remove the container afterwards.
- A schema change needs a Strapi restart before saves include the new attribute.
- After schema changes run `DATABASE_CLIENT=postgres npx strapi ts:generate-types` and commit `types/generated/` in the same task.
- Nothing is deleted (spec 1.6): `pricing`, the season fields of `site-settings.registration` and the old registration columns stay. 2A only stops reading the season text in the registration controller.
- Branch `feat/registration-rebuild`. 2A changes the public form contract (Task 2, Task 9), so the branch is not deployed before plan 2C (the new form) is merged on it.

## Review Focus

- Two submits at the same moment get two different numbers and both succeed (Task 5: parallel allocation test and stale-read test; Task 11: five parallel POSTs).
- Registrations switched off (`registration.open` false) or no current Sezon (none marked, or a malformed one): submission refused with code `closed` and nothing saved; the public read returns `season: null` but still lists prices (Task 4, Task 6, Task 9).
- An unknown `?scoala=` slug, the Club slug or a school without a public page is refused (`unknown-school`), never silently mapped to another school (Task 4, Task 9, Task 11).
- An item with only one price (1 ședință grup: non-member only; Gold: member only) is offered only to that audience; a member choosing "1 ședință grup" is refused; the stored price comes from the server, never from the client body (Task 3, Task 6, Task 9).
- The public endpoint never returns a private field (`documentId`, `id`, `included`, `location`, timestamps, the season's `documentId`), and never lists Club or a section without a public page (Task 6 whitelist and Club tests; Task 11 grep on the live response).

---

## File Structure

```
src/club/
  registration-form-options.ts   script form option lists and "other" labels (Task 2)
  narrow.ts                      asText, asTextList: unknown -> clean values (Task 3)
  price-item.ts                  price kinds, audiences, offeredItems, isIncomplete, duplicateItemNames (Task 3)
  current-season.ts              CurrentSeason, pickCurrentSeason, findCurrentSeason (Task 4)
  school-choice.ts               pickSchool (?scoala or the single school with a public page) (Task 4)
  registration-number.ts         + nextRegistrationNumber (Task 5)
  number-allocator.ts            allocateRegistrationNumber, isRegistrationNumberClash (Task 5)
  public-info.ts                 public response types, builders, resolveSubscriptionChoice (Task 6)
  public-info-loader.ts          loadPublicClubInfo, loadSchoolPrices (Strapi reads) (Task 6)
  registration-input.ts          readRegistrationInput, presenceValues, selectValues, checkRegistrationRules (Task 7)
  registration-submit.ts         submitRegistration, SubmitDeps, RegistrationCreateData (Task 9)
  migrate/registration-copy.ts   planTooltipCopy, planPriceNotesCopy, planSchoolPublicPage, planCustomQuestionRemoval, checkSeasonAgainstLegacy (Task 8)
src/api/registration-submission/
  content-types/.../schema.json  new fields, DB unique index on registrationNumber (Task 1)
  services/registration-submission.ts  createNumbered (Task 5)
  submit-deps.ts                 buildSubmitDeps(strapi) (Task 9)
  controllers/registration-submission.ts  submitPublic and getActiveSeason rewired (Task 9)
src/api/club/routes/01-public.ts GET /api/club/public (Task 6)
src/api/club/controllers/club.ts + publicInfo (Task 6)
src/api/form-config/registry.ts  `inscriere` rewritten to the script form (Task 2)
src/components/club/price-item.json, src/api/section/...  (Task 1)
scripts/migrate-registration-data.js  one-time copy and cleanup, dry run by default (Task 10)
```

## Tasks and parallel groups

| Group | Tasks | Runs after |
|---|---|---|
| A | 1 Schemas, 2 Form options + registry, 3 Price rules, 4 Season + school lookup, 5 Numbering | nothing; all five in parallel (separate files) |
| B | 6 Public read, 7 Registration input, 8 Copy planners | group A; all three in parallel |
| C | 9 Submit flow, 10 Copy script | group B; both in parallel |
| D | 11 Boot check on a throwaway Postgres | everything |

---

### Task 1: Schema changes

**Files:**
- Modify: `src/api/registration-submission/content-types/registration-submission/schema.json`
- Modify: `src/components/club/price-item.json`
- Modify: `src/api/section/content-types/section/schema.json`
- Modify: `src/club/__tests__/existing-links.test.ts:14`
- Create: `src/club/__tests__/registration-schemas.test.ts`
- Regenerate: `types/generated/contentTypes.d.ts`, `types/generated/components.d.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (database attributes later tasks read and write):
  - registration-submission: `relationship` enum `parinte|tutore|alta`, `relationshipOther` string, `childHeight` integer, `lastSeason` string, `membershipAnswer` enum `da|nu`, `subscriptionChoice` json, `source` string, `sourceOther` string, `gdprConsent` boolean, `regulationsConsent` boolean. `howHeard` and `privacyConsent` no longer required. `registrationNumber` has a real database unique index (`column.unique`).
  - `club.price-item.tooltip` text; `section.priceNotes` json. No list visibility field: `showPublic` was dropped (user, 2026-10-19).

Why `column: { unique: true }`: Strapi's `unique: true` is only an application check (read, then insert), so two simultaneous submits can both pass it (checked while writing this plan on a throwaway Postgres: three concurrent creates with the same number all passed Strapi's check; the index rejected two with Postgres error `23505`). `node_modules/@strapi/database/dist/schema/schema.js` creates a unique index only from `attribute.column.unique`. Why relax `howHeard` and `privacyConsent`: with draft and publish off, the document service enforces `required` on create (`entries.js`, `isDraft: false`), and the new form no longer asks these two questions.

- [ ] **Step 1: Write the failing schema test**

`src/club/__tests__/registration-schemas.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const read = (p: string) => JSON.parse(readFileSync(join(SRC, p), 'utf8'));
const registration = () =>
  read('api/registration-submission/content-types/registration-submission/schema.json').attributes;

describe('registration-submission, phase 2 fields', () => {
  it('stores the script form answers', () => {
    const a = registration();
    expect(a.relationship).toEqual({ type: 'enumeration', enum: ['parinte', 'tutore', 'alta'] });
    expect(a.relationshipOther).toEqual({ type: 'string' });
    expect(a.childHeight).toEqual({ type: 'integer' });
    expect(a.lastSeason).toEqual({ type: 'string' });
    expect(a.membershipAnswer).toEqual({ type: 'enumeration', enum: ['da', 'nu'] });
    expect(a.subscriptionChoice).toEqual({ type: 'json' });
    expect(a.source).toEqual({ type: 'string' });
    expect(a.sourceOther).toEqual({ type: 'string' });
    expect(a.gdprConsent).toEqual({ type: 'boolean' });
    expect(a.regulationsConsent).toEqual({ type: 'boolean' });
  });

  it('no longer requires answers only the old website form asked', () => {
    const a = registration();
    expect(a.howHeard).toEqual({ type: 'string' });
    expect(a.privacyConsent).toEqual({ type: 'boolean', default: false });
  });

  it('enforces unique numbers in the database, not only in Strapi', () => {
    expect(registration().registrationNumber).toEqual({ type: 'string', unique: true, column: { unique: true } });
  });
});

describe('prices and notes', () => {
  it('price items carry an optional tooltip', () => {
    expect(read('components/club/price-item.json').attributes.tooltip).toEqual({ type: 'text' });
  });

  it('price lists have no visibility switch (every list is shown, per audience)', () => {
    expect(read('api/price-list/content-types/price-list/schema.json').attributes.showPublic).toBeUndefined();
  });

  it('sections carry their price notes as a json list', () => {
    expect(read('api/section/content-types/section/schema.json').attributes.priceNotes).toEqual({ type: 'json' });
  });
});
```

In `src/club/__tests__/existing-links.test.ts` line 14, replace:

```ts
  expect(s.attributes.registrationNumber).toEqual({ type: 'string', unique: true });
```

with:

```ts
  expect(s.attributes.registrationNumber).toEqual({ type: 'string', unique: true, column: { unique: true } });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- src/club/__tests__/registration-schemas.test.ts src/club/__tests__/existing-links.test.ts`
Expected: FAIL (`relationship` is undefined, `howHeard` still has `required`, `registrationNumber` has no `column`, `tooltip` undefined).

- [ ] **Step 3: Change the schemas**

In `src/api/registration-submission/content-types/registration-submission/schema.json`:

Replace

```json
    "howHeard": {
      "type": "string",
      "required": true
    },
```

with

```json
    "howHeard": {
      "type": "string"
    },
```

Replace

```json
    "privacyConsent": {
      "type": "boolean",
      "required": true,
      "default": false
    },
```

with

```json
    "privacyConsent": {
      "type": "boolean",
      "default": false
    },
```

Replace the last four attributes

```json
    "registrationNumber": { "type": "string", "unique": true },
    "section": { "type": "relation", "relation": "manyToOne", "target": "api::section.section" },
    "seasonRef": { "type": "relation", "relation": "manyToOne", "target": "api::season.season" },
    "athlete": { "type": "relation", "relation": "manyToOne", "target": "api::athlete.athlete" }
```

with

```json
    "registrationNumber": { "type": "string", "unique": true, "column": { "unique": true } },
    "section": { "type": "relation", "relation": "manyToOne", "target": "api::section.section" },
    "seasonRef": { "type": "relation", "relation": "manyToOne", "target": "api::season.season" },
    "athlete": { "type": "relation", "relation": "manyToOne", "target": "api::athlete.athlete" },
    "relationship": { "type": "enumeration", "enum": ["parinte", "tutore", "alta"] },
    "relationshipOther": { "type": "string" },
    "childHeight": { "type": "integer" },
    "lastSeason": { "type": "string" },
    "membershipAnswer": { "type": "enumeration", "enum": ["da", "nu"] },
    "subscriptionChoice": { "type": "json" },
    "source": { "type": "string" },
    "sourceOther": { "type": "string" },
    "gdprConsent": { "type": "boolean" },
    "regulationsConsent": { "type": "boolean" }
```

No defaults on the new booleans: old registrations keep `null` ("not asked"), which is how the admin and the Sheet tell old from new.

In `src/components/club/price-item.json`, after the `"included"` line add a comma to it and:

```json
    "tooltip": { "type": "text" }
```

In `src/api/section/content-types/section/schema.json`, after `"location": ...` add a comma and:

```json
    "priceNotes": { "type": "json" }
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -- src/club/__tests__/registration-schemas.test.ts src/club/__tests__/existing-links.test.ts`
Expected: PASS.

- [ ] **Step 5: Regenerate the types and type-check**

Run: `DATABASE_CLIENT=postgres npx strapi ts:generate-types`
(No database is contacted; the variable only picks an installed driver, since the default `sqlite` driver is not installed and `.env` sets no client.)
Expected: `types/generated/contentTypes.d.ts` gains `relationship`, `childHeight`, `subscriptionChoice`, `priceNotes`; `howHeard` loses `Schema.Attribute.Required`; `types/generated/components.d.ts` gains `tooltip`.
Run: `npx tsc --noEmit` (zero errors) and `npm test` (all PASS).

- [ ] **Step 6: Commit**

```bash
git add src/api/registration-submission/content-types/registration-submission/schema.json \
  src/components/club/price-item.json src/api/section/content-types/section/schema.json src/club/__tests__/registration-schemas.test.ts \
  src/club/__tests__/existing-links.test.ts types/generated
git commit -m "feat(club): registration form fields, price tooltips and section price notes"
```

---

### Task 2: Script form options and the `inscriere` registry

**Files:**
- Create: `src/club/registration-form-options.ts`
- Test: `src/club/__tests__/registration-form-options.test.ts`
- Modify: `src/api/form-config/registry.ts` (imports at the top; `SENSITIVE_BUILTIN_KEYS`; delete `LEVEL_VALUES`; replace the whole `const inscriere: RegistryForm = { ... };` block)
- Test: `src/api/form-config/__tests__/registry-inscriere.test.ts`
- Create: `src/api/form-config/custom-policy.ts`
- Modify: `src/api/form-config/services/form-config.ts` (import; `publicConfig`)
- Test: `src/api/form-config/__tests__/public-config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (`src/club/registration-form-options.ts`):
  - `RELATIONSHIP_OPTIONS: readonly { value: 'parinte' | 'tutore' | 'alta'; label: string }[]`, `type Relationship`, `RELATIONSHIP_OTHER: Relationship` (`'alta'`), `RELATIONSHIP_OTHER_LABEL: string`
  - `MEMBERSHIP_OPTIONS: readonly { value: 'da' | 'nu'; label: string }[]`, `type MembershipAnswer`, `MEMBERSHIP_YES`, `MEMBERSHIP_NO`
  - `LAST_SEASON_OPTIONS: readonly string[]`, `SOURCE_OPTIONS: readonly string[]`, `SOURCE_OTHER` (`'Altele'`), `SOURCE_OTHER_LABEL`
  - `isRelationship(v: string): v is Relationship`, `isMembershipAnswer(v: string): v is MembershipAnswer`
- Produces (`src/api/form-config/custom-policy.ts`): `FORMS_WITHOUT_CUSTOM_QUESTIONS: ReadonlySet<FormType>` (`inscriere`), `withoutCustomQuestions<T extends { custom?: unknown }>(type: FormType, overlay: T): T`. `publicConfig('inscriere')` never returns custom questions, even if an admin adds some again.
- Produces (registry `inscriere`): steps `date`, `abonament`, `finalizare`; question keys listed in the test below. `subscriptionChoice` is a `select` with `optionSource: 'none'` and no options (its options come from the price lists).

Sources: option lists and the two "other" labels were read from the live Apps Script form (coordinator, 2026-10-19). Question labels are from the approved mockup `edusport_frontend/docs/portal/mockups/gen_steps.py` (mockup-sourced). The script form submits "Da"/"Nu" for membership; we store the spec enum `da`/`nu` with the script's labels.

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/registration-form-options.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  LAST_SEASON_OPTIONS,
  MEMBERSHIP_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RELATIONSHIP_OTHER,
  RELATIONSHIP_OTHER_LABEL,
  SOURCE_OPTIONS,
  SOURCE_OTHER,
  SOURCE_OTHER_LABEL,
  isMembershipAnswer,
  isRelationship,
} from '../registration-form-options';

describe('script form options', () => {
  it('match the live script form word for word', () => {
    expect(LAST_SEASON_OPTIONS).toEqual(['Nu a participat', 'Începători', 'Intermediari', 'Avansați']);
    expect(SOURCE_OPTIONS).toEqual(['Facebook', 'Instagram', 'Recomandare', 'Căutare Google', 'Altele']);
    expect(RELATIONSHIP_OPTIONS.map((o) => o.label)).toEqual(['Părinte', 'Tutore Legal', 'Alta (Vă rugăm specificați)']);
    expect(MEMBERSHIP_OPTIONS.map((o) => o.label)).toEqual([
      'Da, doresc să devin membru',
      'Nu, optez pentru tarife neafiliați',
    ]);
    expect(RELATIONSHIP_OTHER_LABEL).toBe('Specificați calitatea (ex: Bunic, Frate):');
    expect(SOURCE_OTHER_LABEL).toBe('Vă rugăm să specificați de unde ați aflat de noi:');
  });

  it('stores the spec enum values', () => {
    expect(RELATIONSHIP_OPTIONS.map((o) => o.value)).toEqual(['parinte', 'tutore', 'alta']);
    expect(MEMBERSHIP_OPTIONS.map((o) => o.value)).toEqual(['da', 'nu']);
  });

  it('the free-text answers are among the options', () => {
    expect(SOURCE_OPTIONS).toContain(SOURCE_OTHER);
    expect(RELATIONSHIP_OPTIONS.map((o) => o.value)).toContain(RELATIONSHIP_OTHER);
  });

  it('uses comma-below ș and ț, never the cedilla', () => {
    const all = JSON.stringify([LAST_SEASON_OPTIONS, SOURCE_OPTIONS, RELATIONSHIP_OPTIONS, MEMBERSHIP_OPTIONS]);
    expect(all).not.toMatch(/[şţŞŢ]/);
  });

  it('recognises stored values only', () => {
    expect(isRelationship('tutore')).toBe(true);
    expect(isRelationship('Părinte')).toBe(false);
    expect(isMembershipAnswer('da')).toBe(true);
    expect(isMembershipAnswer('Da')).toBe(false);
  });
});
```

`src/api/form-config/__tests__/registry-inscriere.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { REGISTRY, SENSITIVE_BUILTIN_KEYS, questionMap } from '../registry';
import {
  LAST_SEASON_OPTIONS,
  MEMBERSHIP_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RELATIONSHIP_OTHER_LABEL,
  SOURCE_OPTIONS,
  SOURCE_OTHER_LABEL,
} from '../../../club/registration-form-options';

const q = questionMap('inscriere');
const pairs = (list: readonly { value: string; label: string }[]) => list.map((o) => ({ value: o.value, label: o.label }));
const same = (list: readonly string[]) => list.map((v) => ({ value: v, label: v }));

describe('registry inscriere (script form)', () => {
  it('has the 3 approved steps with the script form questions in order', () => {
    expect(REGISTRY.inscriere.steps.map((s) => [s.key, s.title, s.questions.map((x) => x.key)])).toEqual([
      [
        'date',
        'Date înscriere',
        ['email', 'parentName', 'relationship', 'relationshipOther', 'phone', 'childName', 'childBirthDate',
          'childHeight', 'shirtSize', 'lastSeason', 'priorExperience', 'expectations'],
      ],
      ['abonament', 'Abonament', ['membershipAnswer', 'subscriptionChoice']],
      ['finalizare', 'Finalizare înscriere', ['source', 'sourceOther', 'gdprConsent', 'regulationsConsent']],
    ]);
  });

  it('drops the questions only the old website form had', () => {
    for (const key of ['level', 'howHeard', 'clubInterest', 'privacyConsent', 'regulationsAgreement', 'infoBlock', 'programCard']) {
      expect(q[key]).toBeUndefined();
    }
  });

  it('reads every option list from the constants module', () => {
    expect(q.relationship.q.options).toEqual(pairs(RELATIONSHIP_OPTIONS));
    expect(q.membershipAnswer.q.options).toEqual(pairs(MEMBERSHIP_OPTIONS));
    expect(q.lastSeason.q.options).toEqual(same(LAST_SEASON_OPTIONS));
    expect(q.source.q.options).toEqual(same(SOURCE_OPTIONS));
  });

  it('locks option values so the admin editor cannot add new ones', () => {
    for (const key of ['relationship', 'membershipAnswer', 'lastSeason', 'source']) {
      expect(q[key].q.optionSource).toBe('enum');
    }
  });

  it('takes subscription options from the price lists, never from the registry', () => {
    expect(q.subscriptionChoice.q).toMatchObject({ type: 'select', optionSource: 'none', options: [] });
  });

  it('keeps identity, price-relevant answers and consents required for good', () => {
    for (const key of ['email', 'childName', 'relationship', 'membershipAnswer', 'subscriptionChoice', 'gdprConsent', 'regulationsConsent']) {
      expect(q[key].q.lockedRequired).toBe(true);
    }
  });

  it('asks the follow-up texts only with Alta / Altele (checked at submit)', () => {
    expect(q.relationshipOther.q).toMatchObject({ required: false, canHide: false, defaultLabel: RELATIONSHIP_OTHER_LABEL });
    expect(q.sourceOther.q).toMatchObject({ required: false, canHide: false, defaultLabel: SOURCE_OTHER_LABEL });
  });

  it('asks for confirmation before removing a consent', () => {
    expect(SENSITIVE_BUILTIN_KEYS.has('gdprConsent')).toBe(true);
    expect(SENSITIVE_BUILTIN_KEYS.has('regulationsConsent')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- src/club/__tests__/registration-form-options.test.ts src/api/form-config/__tests__/registry-inscriere.test.ts`
Expected: FAIL (`Cannot find module '../registration-form-options'`).

- [ ] **Step 3: Create the constants module**

`src/club/registration-form-options.ts`:

```ts
/**
 * Options of the club's script form (live Apps Script form, read 2026-10-19), word for word.
 * The registry `inscriere` and the submit validation read these lists; change them only here.
 */

export const RELATIONSHIP_OPTIONS = [
  { value: 'parinte', label: 'Părinte' },
  { value: 'tutore', label: 'Tutore Legal' },
  { value: 'alta', label: 'Alta (Vă rugăm specificați)' },
] as const;
export type Relationship = (typeof RELATIONSHIP_OPTIONS)[number]['value'];
export const RELATIONSHIP_OTHER: Relationship = 'alta';
export const RELATIONSHIP_OTHER_LABEL = 'Specificați calitatea (ex: Bunic, Frate):';

/** Stored as the spec enum `da` / `nu`; the script form submits "Da" / "Nu" with these labels. */
export const MEMBERSHIP_OPTIONS = [
  { value: 'da', label: 'Da, doresc să devin membru' },
  { value: 'nu', label: 'Nu, optez pentru tarife neafiliați' },
] as const;
export type MembershipAnswer = (typeof MEMBERSHIP_OPTIONS)[number]['value'];
export const MEMBERSHIP_YES: MembershipAnswer = 'da';
export const MEMBERSHIP_NO: MembershipAnswer = 'nu';

/** "Sezonul trecut ..." answers, stored as the text itself. */
export const LAST_SEASON_OPTIONS = ['Nu a participat', 'Începători', 'Intermediari', 'Avansați'] as const;

/** "De unde ați aflat ..." answers, stored as the text itself. */
export const SOURCE_OPTIONS = ['Facebook', 'Instagram', 'Recomandare', 'Căutare Google', 'Altele'] as const;
export const SOURCE_OTHER = 'Altele';
export const SOURCE_OTHER_LABEL = 'Vă rugăm să specificați de unde ați aflat de noi:';

export function isRelationship(v: string): v is Relationship {
  return RELATIONSHIP_OPTIONS.some((o) => o.value === v);
}

export function isMembershipAnswer(v: string): v is MembershipAnswer {
  return MEMBERSHIP_OPTIONS.some((o) => o.value === v);
}
```

- [ ] **Step 4: Rewrite the `inscriere` registry**

In `src/api/form-config/registry.ts`:

After the header comment, before `export type FormType`, add:

```ts
import {
  LAST_SEASON_OPTIONS,
  MEMBERSHIP_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RELATIONSHIP_OTHER_LABEL,
  SOURCE_OPTIONS,
  SOURCE_OTHER_LABEL,
} from '../../club/registration-form-options';
```

Replace

```ts
export const SENSITIVE_BUILTIN_KEYS = new Set<string>([
  'email',
  'privacyConsent',
  'regulationsAgreement',
]);
```

with

```ts
export const SENSITIVE_BUILTIN_KEYS = new Set<string>([
  'email',
  'privacyConsent',
  'regulationsAgreement',
  'gdprConsent',
  'regulationsConsent',
]);
```

Delete the `const LEVEL_VALUES = [ ... ] as const;` block (only the old `inscriere` used it).

Replace the whole `const inscriere: RegistryForm = { ... };` block with:

```ts
/** Option lists from the constants module, as registry options. */
const sameValueOptions = (values: readonly string[]): RegistryOption[] => values.map((v) => ({ value: v, label: v }));
const pairOptions = (list: readonly { value: string; label: string }[]): RegistryOption[] =>
  list.map((o) => ({ value: o.value, label: o.label }));

/**
 * The club's script form, 3 steps (form-3steps-v1 option B). Labels are from the approved mockup
 * (mockups/gen_steps.py); option lists from src/club/registration-form-options.ts.
 * `subscriptionChoice` has no registry options: they come from the public price lists.
 */
const inscriere: RegistryForm = {
  type: 'inscriere',
  steps: [
    {
      key: 'date',
      title: 'Date înscriere',
      questions: [
        { key: 'email', type: 'email', defaultLabel: 'Adresă de e-mail', required: true, lockedRequired: true, canHide: false, optionSource: 'none' },
        { key: 'parentName', type: 'text', defaultLabel: 'Numele și prenumele persoanei care completează formularul', required: true, canHide: false, optionSource: 'none' },
        { key: 'relationship', type: 'select', defaultLabel: 'Calitatea față de sportiv:', required: true, lockedRequired: true, canHide: false, optionSource: 'enum', options: pairOptions(RELATIONSHIP_OPTIONS) },
        { key: 'relationshipOther', type: 'text', defaultLabel: RELATIONSHIP_OTHER_LABEL, required: false, canHide: false, optionSource: 'none' },
        { key: 'phone', type: 'tel', defaultLabel: 'Telefon de contact', required: true, canHide: false, optionSource: 'none' },
        { key: 'childName', type: 'text', defaultLabel: 'Numele și prenumele copilului', required: true, lockedRequired: true, canHide: false, optionSource: 'none' },
        { key: 'childBirthDate', type: 'text', defaultLabel: 'Data nașterii copilului', required: true, canHide: false, optionSource: 'none' },
        { key: 'childHeight', type: 'text', defaultLabel: 'Înălțimea copilului (cm)', required: true, canHide: false, optionSource: 'none' },
        { key: 'shirtSize', type: 'text', defaultLabel: 'Măsura bluză', required: true, canHide: false, optionSource: 'none' },
        { key: 'lastSeason', type: 'select', defaultLabel: 'Sezonul trecut fiul/fiica dvs. a participat la cursurile ACS EduSport?', required: true, canHide: false, optionSource: 'enum', options: sameValueOptions(LAST_SEASON_OPTIONS) },
        {
          key: 'priorExperience',
          type: 'longtext',
          defaultLabel: 'Nivel de experiență / Elemente cunoscute',
          defaultHelp:
            "Dacă este prima participare, menționați dacă a mai luat lecții. Dacă a mai fost înscris la ACS EduSport, completați cu 'Nu este cazul'.",
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        { key: 'expectations', type: 'longtext', defaultLabel: 'Așteptări de la cursurile de patinaj', required: true, canHide: false, optionSource: 'none' },
      ],
    },
    {
      key: 'abonament',
      title: 'Abonament',
      questions: [
        { key: 'membershipAnswer', type: 'select', defaultLabel: 'Doriți înscrierea ca membru A.C.S. EduSport pentru tarife preferențiale?', required: true, lockedRequired: true, canHide: false, optionSource: 'enum', options: pairOptions(MEMBERSHIP_OPTIONS) },
        { key: 'subscriptionChoice', type: 'select', defaultLabel: 'La primul modul doriți să achiziționați:', required: true, lockedRequired: true, canHide: false, optionSource: 'none', options: [] },
      ],
    },
    {
      key: 'finalizare',
      title: 'Finalizare înscriere',
      questions: [
        { key: 'source', type: 'select', defaultLabel: 'De unde ați aflat de cursurile noastre?', required: true, canHide: false, optionSource: 'enum', options: sameValueOptions(SOURCE_OPTIONS) },
        { key: 'sourceOther', type: 'text', defaultLabel: SOURCE_OTHER_LABEL, required: false, canHide: false, optionSource: 'none' },
        {
          key: 'gdprConsent',
          type: 'checkbox',
          defaultDisplay: 'plain',
          defaultTitle: 'Consimțământ GDPR',
          defaultLabel: 'Confirm citirea documentului Politica de Confidențialitate și sunt de acord cu prelucrarea datelor.',
          defaultLinkUrl: '/protectia-datelor',
          defaultLinkLabel: 'Politica de Confidențialitate',
          required: true,
          lockedRequired: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'regulationsConsent',
          type: 'checkbox',
          defaultDisplay: 'plain',
          defaultTitle: 'Acord Regulament',
          defaultLabel: 'Confirm că am citit, înțeles și acceptat condițiile prezentate în Regulamentul Școlii de Patinaj.',
          defaultLinkUrl: '/cursuri/regulament',
          defaultLinkLabel: 'Regulamentul Școlii de Patinaj',
          required: true,
          lockedRequired: true,
          canHide: false,
          optionSource: 'none',
        },
      ],
    },
  ],
};
```

Note for the reviewer: `validateBuiltinSelects` skips any select key not present in the values it is given, so `subscriptionChoice` (no registry options) is never validated there; Task 9 validates it against the price lists. The admin editor rejects new options for it because `optionSource` is not `freetext`.

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test -- src/club/__tests__/registration-form-options.test.ts src/api/form-config/__tests__/registry-inscriere.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test: no custom questions on the public registration form**

The registration form has no custom questions (user decision 2026-10-03). An admin could still add one in the form editor; a required one would block every registration, since the new form never sends `extra`. So the public config of `inscriere` drops them. The test loads the real service factory with `@strapi/strapi` mocked, so Strapi does not boot.

`src/api/form-config/__tests__/public-config.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

// Load the real service factory without booting Strapi.
vi.mock('@strapi/strapi', () => ({ factories: { createCoreService: (_uid: string, build: unknown) => build } }));

import { withoutCustomQuestions } from '../custom-policy';
import buildService from '../services/form-config';

type PublicModel = { steps: { key: string; questions: { key: string }[] }[] };
type Service = { publicConfig(type: string): Promise<PublicModel> };

function service(overlay: unknown): Service {
  const strapi = { documents: () => ({ findFirst: async () => ({ overlay }) }) };
  return (buildService as unknown as (ctx: { strapi: unknown }) => Service)({ strapi });
}

const keys = (m: PublicModel) => m.steps.flatMap((s) => s.questions.map((q) => q.key));
const custom = (step: string) => ({ key: 'c_old1', type: 'text', step, label: 'Întrebare veche', required: true });

describe('custom questions', () => {
  it('never appear on the public registration form, even when stored', async () => {
    const model = await service({ custom: [custom('date')], order: { date: ['email', 'c_old1'] } }).publicConfig('inscriere');
    expect(keys(model)).not.toContain('c_old1');
    expect(keys(model)).toContain('email');
  });

  it('still appear on the other forms', async () => {
    const model = await service({ custom: [custom('contact')] }).publicConfig('contact');
    expect(keys(model)).toContain('c_old1');
  });

  it('withoutCustomQuestions drops them for inscriere only and keeps the rest of the overlay', () => {
    const overlay = { q: { email: { label: 'E-mail' } }, custom: [custom('date')] };
    expect(withoutCustomQuestions('inscriere', overlay)).toEqual({ q: { email: { label: 'E-mail' } } });
    expect(withoutCustomQuestions('contact', overlay)).toBe(overlay);
  });
});
```

Run: `npm test -- src/api/form-config/__tests__/public-config.test.ts`
Expected: FAIL (`Cannot find module '../custom-policy'`).

- [ ] **Step 7: Hide them**

`src/api/form-config/custom-policy.ts`:

```ts
import type { FormType } from './registry';

/** Forms that never take admin-added questions. The registration form mirrors the club's script form (user decision, 2026-10-03). */
export const FORMS_WITHOUT_CUSTOM_QUESTIONS: ReadonlySet<FormType> = new Set<FormType>(['inscriere']);

/** The overlay as the public form sees it: custom questions removed for the forms above. */
export function withoutCustomQuestions<T extends { custom?: unknown }>(type: FormType, overlay: T): T {
  if (!FORMS_WITHOUT_CUSTOM_QUESTIONS.has(type)) return overlay;
  const next = { ...overlay };
  delete next.custom;
  return next;
}
```

In `src/api/form-config/services/form-config.ts`, after the `} from '../registry';` import add:

```ts
import { withoutCustomQuestions } from '../custom-policy';
```

and replace

```ts
  async publicConfig(type: FormType) {
    const overlay = await this.loadOverlay(type);
    return mergePublicModel(REGISTRY[type], overlay);
  },
```

with

```ts
  async publicConfig(type: FormType) {
    const overlay = await this.loadOverlay(type);
    return mergePublicModel(REGISTRY[type], withoutCustomQuestions(type, overlay));
  },
```

Run: `npm test -- src/api/form-config/__tests__/public-config.test.ts`
Expected: PASS. Then `npm test` and `npx tsc --noEmit`: all PASS, zero errors.

- [ ] **Step 8: Commit**

```bash
git add src/club/registration-form-options.ts src/club/__tests__/registration-form-options.test.ts \
  src/api/form-config/registry.ts src/api/form-config/__tests__/registry-inscriere.test.ts \
  src/api/form-config/custom-policy.ts src/api/form-config/services/form-config.ts \
  src/api/form-config/__tests__/public-config.test.ts
git commit -m "feat(form-config): inscriere registry mirrors the club's script form, without custom questions"
```

---

### Task 3: Price item rules

**Files:**
- Create: `src/club/narrow.ts`, `src/club/price-item.ts`
- Test: `src/club/__tests__/price-item.test.ts`

**Interfaces:**
- Consumes: `nameKey(raw: string): string` from `src/club/migrate/names.ts` (phase 1).
- Produces:
  - `asText(v: unknown): string`, `asTextList(v: unknown): string[]` (`src/club/narrow.ts`)
  - `PRICE_ITEM_KINDS`, `type PriceItemKind = 'subscription' | 'session' | 'individual'`, `type Audience = 'member' | 'nonMember'`, `type PriceItemPrices = { memberPrice?: number | null; nonMemberPrice?: number | null }`
  - `isPriceItemKind(v: unknown): v is PriceItemKind`, `isPrice(v: unknown): v is number`
  - `priceFor(item: PriceItemPrices, audience: Audience): number | null`
  - `isOfferedTo(item: PriceItemPrices, audience: Audience): boolean`
  - `offeredItems<T extends PriceItemPrices>(items: T[], audience: Audience): T[]`
  - `isIncomplete(item: PriceItemPrices): boolean` (true only when both prices are missing)
  - `duplicateItemNames(lists: { items?: { name?: unknown }[] | null }[]): string[]` (names used more than once across one school's lists; case, spaces and diacritics ignored; the copy script reports them, plan 2B blocks saving with it)

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/price-item.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { asText, asTextList } from '../narrow';
import { duplicateItemNames, isIncomplete, isOfferedTo, isPrice, isPriceItemKind, offeredItems, priceFor } from '../price-item';

// Test values; the real Avansați Gold price is entered later in the Prețuri screen.
const sub6 = { name: 'Abonament 6 ședințe grup', memberPrice: 520, nonMemberPrice: 720 };
const single = { name: '1 ședință grup', memberPrice: null, nonMemberPrice: 150 };
const gold = { name: 'Abonament Avansați Gold 8 ședințe', memberPrice: 600, nonMemberPrice: null };
const empty = { name: 'Fără preț', memberPrice: null, nonMemberPrice: null };

describe('offeredItems', () => {
  it('offers each item to the audience it has a price for', () => {
    expect(offeredItems([sub6, single, gold, empty], 'member')).toEqual([sub6, gold]);
    expect(offeredItems([sub6, single, gold, empty], 'nonMember')).toEqual([sub6, single]);
  });

  it('isOfferedTo follows the same rule', () => {
    expect(isOfferedTo(single, 'member')).toBe(false);
    expect(isOfferedTo(gold, 'member')).toBe(true);
  });
});

describe('isIncomplete', () => {
  it('only when both prices are missing', () => {
    expect(isIncomplete(sub6)).toBe(false);
    expect(isIncomplete(single)).toBe(false);
    expect(isIncomplete(gold)).toBe(false);
    expect(isIncomplete(empty)).toBe(true);
    expect(isIncomplete({})).toBe(true);
  });
});

describe('prices', () => {
  it('zero is a price; negative, NaN, text and missing are not', () => {
    expect(isPrice(0)).toBe(true);
    expect(isPrice(590)).toBe(true);
    expect(isPrice(-1)).toBe(false);
    expect(isPrice(Number.NaN)).toBe(false);
    expect(isPrice('590')).toBe(false);
    expect(isPrice(null)).toBe(false);
    expect(isPrice(undefined)).toBe(false);
  });

  it('priceFor picks the audience price', () => {
    expect(priceFor(sub6, 'member')).toBe(520);
    expect(priceFor(sub6, 'nonMember')).toBe(720);
    expect(priceFor(single, 'member')).toBeNull();
  });

  it('knows the price item kinds', () => {
    expect(isPriceItemKind('subscription')).toBe(true);
    expect(isPriceItemKind('abonament')).toBe(false);
  });
});

describe('duplicateItemNames', () => {
  it("finds a name used in two of a school's lists, ignoring case, spaces and diacritics", () => {
    expect(
      duplicateItemNames([
        { items: [{ name: 'Abonament 8 ședințe grup' }, { name: '1 ședință grup' }] },
        { items: [{ name: ' abonament 8 sedinte GRUP' }] },
      ]),
    ).toEqual(['Abonament 8 ședințe grup']);
  });

  it('finds a name repeated inside one list', () => {
    expect(duplicateItemNames([{ items: [{ name: '1 ședință grup' }, { name: '1 ședință grup' }] }])).toEqual(['1 ședință grup']);
  });

  it('is empty when every name is unique or missing', () => {
    expect(duplicateItemNames([{ items: [{ name: 'A' }, { name: '' }, {}] }, { items: null }, {}])).toEqual([]);
  });
});

describe('narrow', () => {
  it('asText trims strings and empties the rest', () => {
    expect(asText('  Standard ')).toBe('Standard');
    expect(asText(7)).toBe('');
    expect(asText(null)).toBe('');
  });

  it('asTextList keeps non-empty strings only', () => {
    expect(asTextList([' a ', '', 3, null, 'b'])).toEqual(['a', 'b']);
    expect(asTextList('a')).toEqual([]);
    expect(asTextList(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npm test -- src/club/__tests__/price-item.test.ts`
Expected: FAIL (`Cannot find module '../narrow'`).

- [ ] **Step 3: Implement**

`src/club/narrow.ts`:

```ts
/** Trimmed text, or '' for anything that is not a string. */
export function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Non-empty trimmed strings from a json list; anything else is dropped. */
export function asTextList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => asText(x)).filter((x) => x !== '') : [];
}
```

`src/club/price-item.ts`:

```ts
import { nameKey } from './migrate/names';

export const PRICE_ITEM_KINDS = ['subscription', 'session', 'individual'] as const;
export type PriceItemKind = (typeof PRICE_ITEM_KINDS)[number];
export type Audience = 'member' | 'nonMember';
export type PriceItemPrices = { memberPrice?: number | null; nonMemberPrice?: number | null };

export function isPriceItemKind(v: unknown): v is PriceItemKind {
  return typeof v === 'string' && (PRICE_ITEM_KINDS as readonly string[]).includes(v);
}

/** A usable price: a finite number, zero included. Empty price fields come back as null. */
export function isPrice(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

export function priceFor(item: PriceItemPrices, audience: Audience): number | null {
  const value = audience === 'member' ? item.memberPrice : item.nonMemberPrice;
  return isPrice(value) ? value : null;
}

/** Offered to members when it has a member price, to non-members when it has a non-member price. */
export function isOfferedTo(item: PriceItemPrices, audience: Audience): boolean {
  return priceFor(item, audience) !== null;
}

export function offeredItems<T extends PriceItemPrices>(items: T[], audience: Audience): T[] {
  return items.filter((item) => isOfferedTo(item, audience));
}

/** Incomplete = offered to nobody. Hidden on the website and in the form; flagged "Preț incomplet" in the admin. */
export function isIncomplete(item: PriceItemPrices): boolean {
  return !isOfferedTo(item, 'member') && !isOfferedTo(item, 'nonMember');
}

/**
 * Item names used more than once across one school's price lists (case, spaces and diacritics
 * ignored), as first written. The form identifies the chosen item by its name, so names must be unique.
 */
export function duplicateItemNames(lists: { items?: { name?: unknown }[] | null }[]): string[] {
  const seen = new Map<string, { name: string; count: number }>();
  for (const item of lists.flatMap((l) => l.items ?? [])) {
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name) continue;
    const entry = seen.get(nameKey(name)) ?? { name, count: 0 };
    seen.set(nameKey(name), { name: entry.name, count: entry.count + 1 });
  }
  return [...seen.values()].filter((e) => e.count > 1).map((e) => e.name);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/club/__tests__/price-item.test.ts`
Expected: PASS. Then `npx tsc --noEmit`: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/narrow.ts src/club/price-item.ts src/club/__tests__/price-item.test.ts
git commit -m "feat(club): price items offered per audience, incomplete without any price, duplicate names"
```

---

### Task 4: Current season and school choice

**Files:**
- Create: `src/club/current-season.ts`, `src/club/school-choice.ts`
- Test: `src/club/__tests__/current-season.test.ts`, `src/club/__tests__/school-choice.test.ts`

**Interfaces:**
- Consumes: `normalizeSeasonLabel(raw): string | null` from `src/club/season.ts`.
- Produces:
  - `type CurrentSeason = { documentId: string; label: string; startMonth: string; endMonth: string; membershipFee: number | null }`
  - `type RawSeason = { documentId?: unknown; label?: unknown; startMonth?: unknown; endMonth?: unknown; membershipFee?: unknown; isCurrent?: unknown }`
  - `pickCurrentSeason(rows: RawSeason[]): CurrentSeason | null` (several marked current: latest label wins)
  - `findCurrentSeason(strapi: Core.Strapi): Promise<CurrentSeason | null>`
  - `type SchoolRow = { documentId?: unknown; slug?: unknown; kind?: unknown; publicPage?: unknown }`
  - `type SchoolChoiceCode = 'closed' | 'unknown-school' | 'choose-school'` (`closed`: no school can take registrations)
  - `type SchoolChoice = { ok: true; documentId: string; slug: string } | { ok: false; code: SchoolChoiceCode }`
  - `pickSchool(rows: SchoolRow[], slug: string | null): SchoolChoice`

Rule (user, 2026-10-19): a registration target is a section with `kind = 'school'` and `publicPage = true`. The per-section `registrationsOpen` is ignored for now (one global switch, checked in Task 9). Club is never a target. A `?scoala=` slug that is not a target, including `club`, is `unknown-school`.

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/current-season.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickCurrentSeason } from '../current-season';

const row = (over: Record<string, unknown>) => ({
  documentId: 'season-2026',
  label: '2026-2027',
  startMonth: '2026-10-01',
  endMonth: '2027-05-31',
  membershipFee: 250,
  isCurrent: true,
  createdAt: '2026-10-19T08:00:00.000Z',
  ...over,
});

describe('pickCurrentSeason', () => {
  it('returns the season marked current, with only the fields callers need', () => {
    expect(pickCurrentSeason([row({ documentId: 'season-2025', label: '2025-2026', isCurrent: false }), row({})])).toEqual({
      documentId: 'season-2026',
      label: '2026-2027',
      startMonth: '2026-10-01',
      endMonth: '2027-05-31',
      membershipFee: 250,
    });
  });

  it('returns null when no season is current', () => {
    expect(pickCurrentSeason([])).toBeNull();
    expect(pickCurrentSeason([row({ isCurrent: false })])).toBeNull();
    expect(pickCurrentSeason([row({ isCurrent: null })])).toBeNull();
  });

  it('takes the latest label when several are marked current', () => {
    const picked = pickCurrentSeason([row({ label: '2026-2027' }), row({ documentId: 'season-2027', label: '2027-2028' })]);
    expect(picked?.label).toBe('2027-2028');
  });

  it('skips malformed rows instead of using them', () => {
    expect(pickCurrentSeason([row({ label: '2026–2027' })])).toBeNull();
    expect(pickCurrentSeason([row({ startMonth: null })])).toBeNull();
    expect(pickCurrentSeason([row({ documentId: undefined })])).toBeNull();
  });

  it('a missing fee is null, not zero', () => {
    expect(pickCurrentSeason([row({ membershipFee: null })])?.membershipFee).toBeNull();
  });
});
```

`src/club/__tests__/school-choice.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickSchool } from '../school-choice';

// registrationsOpen is set on purpose: it must not matter yet.
const school = { documentId: 'sec-school', slug: 'afi-cotroceni', kind: 'school', publicPage: true, registrationsOpen: false };
const club = { documentId: 'sec-club', slug: 'club', kind: 'club', publicPage: true, registrationsOpen: true };
const second = { documentId: 'sec-two', slug: 'baneasa', kind: 'school', publicPage: true };
const hidden = { documentId: 'sec-hidden', slug: 'ascunsa', kind: 'school', publicPage: false, registrationsOpen: true };

describe('pickSchool', () => {
  it('uses the single school with a public page when the link has no ?scoala', () => {
    expect(pickSchool([school, club, hidden], null)).toEqual({ ok: true, documentId: 'sec-school', slug: 'afi-cotroceni' });
    expect(pickSchool([school, club], '  ')).toEqual({ ok: true, documentId: 'sec-school', slug: 'afi-cotroceni' });
  });

  it('uses the school named in ?scoala, ignoring case and spaces', () => {
    expect(pickSchool([school, second], ' Baneasa ')).toEqual({ ok: true, documentId: 'sec-two', slug: 'baneasa' });
  });

  it('refuses an unknown slug instead of falling back to another school', () => {
    expect(pickSchool([school, club], 'nu-exista')).toEqual({ ok: false, code: 'unknown-school' });
  });

  it('never takes Club, nor a school without a public page', () => {
    expect(pickSchool([school, club], 'club')).toEqual({ ok: false, code: 'unknown-school' });
    expect(pickSchool([school, hidden], 'ascunsa')).toEqual({ ok: false, code: 'unknown-school' });
  });

  it('asks to choose when 2 or more schools have a public page and none is named', () => {
    expect(pickSchool([school, second], null)).toEqual({ ok: false, code: 'choose-school' });
  });

  it('is closed when no school can take registrations', () => {
    expect(pickSchool([club, hidden], null)).toEqual({ ok: false, code: 'closed' });
    expect(pickSchool([], null)).toEqual({ ok: false, code: 'closed' });
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- src/club/__tests__/current-season.test.ts src/club/__tests__/school-choice.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/club/current-season.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { normalizeSeasonLabel } from './season';

export type CurrentSeason = {
  documentId: string;
  label: string;
  startMonth: string;
  endMonth: string;
  membershipFee: number | null;
};

export type RawSeason = {
  documentId?: unknown;
  label?: unknown;
  startMonth?: unknown;
  endMonth?: unknown;
  membershipFee?: unknown;
  isCurrent?: unknown;
};

const isText = (v: unknown): v is string => typeof v === 'string' && v !== '';

function toCurrentSeason(row: RawSeason): CurrentSeason | null {
  const { documentId, label, startMonth, endMonth, membershipFee } = row;
  if (!isText(documentId) || !isText(label) || normalizeSeasonLabel(label) !== label) return null;
  if (!isText(startMonth) || !isText(endMonth)) return null;
  const fee = typeof membershipFee === 'number' && Number.isFinite(membershipFee) ? membershipFee : null;
  return { documentId, label, startMonth, endMonth, membershipFee: fee };
}

/** The Sezon marked current. Several marked current should not happen; the latest label wins. */
export function pickCurrentSeason(rows: RawSeason[]): CurrentSeason | null {
  const current = rows
    .filter((r) => r.isCurrent === true)
    .map(toCurrentSeason)
    .filter((s): s is CurrentSeason => s !== null)
    .sort((a, b) => b.label.localeCompare(a.label));
  return current[0] ?? null;
}

export async function findCurrentSeason(strapi: Core.Strapi): Promise<CurrentSeason | null> {
  const rows = await strapi.documents('api::season.season').findMany({ filters: { isCurrent: true }, limit: 10 });
  return pickCurrentSeason(rows);
}
```

`src/club/school-choice.ts`:

```ts
export type SchoolRow = { documentId?: unknown; slug?: unknown; kind?: unknown; publicPage?: unknown };
export type SchoolChoiceCode = 'closed' | 'unknown-school' | 'choose-school';
export type SchoolChoice = { ok: true; documentId: string; slug: string } | { ok: false; code: SchoolChoiceCode };

type School = { documentId: string; slug: string };

/** Registration targets: school sections with a public page. Club never; `registrationsOpen` is not used yet. */
function targetSchools(rows: SchoolRow[]): School[] {
  const schools: School[] = [];
  for (const r of rows) {
    if (r.kind !== 'school' || r.publicPage !== true) continue;
    if (typeof r.documentId !== 'string' || typeof r.slug !== 'string') continue;
    schools.push({ documentId: r.documentId, slug: r.slug });
  }
  return schools;
}

/** The school for a registration: the one named by `?scoala=<slug>`, or the only target school. */
export function pickSchool(rows: SchoolRow[], slug: string | null): SchoolChoice {
  const schools = targetSchools(rows);
  const wanted = (slug ?? '').trim().toLowerCase();
  if (wanted) {
    const hit = schools.find((s) => s.slug === wanted);
    return hit ? { ok: true, ...hit } : { ok: false, code: 'unknown-school' };
  }
  if (schools.length === 1) return { ok: true, ...schools[0] };
  return { ok: false, code: schools.length === 0 ? 'closed' : 'choose-school' };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -- src/club/__tests__/current-season.test.ts src/club/__tests__/school-choice.test.ts`
Expected: PASS. Then `npx tsc --noEmit`: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/current-season.ts src/club/school-choice.ts \
  src/club/__tests__/current-season.test.ts src/club/__tests__/school-choice.test.ts
git commit -m "feat(club): current season lookup and school choice for registrations"
```

---

### Task 5: Registration numbers at submit

**Files:**
- Modify: `src/club/registration-number.ts` (add `nextRegistrationNumber` after `parseRegistrationNumber`)
- Create: `src/club/number-allocator.ts`
- Modify: `src/api/registration-submission/services/registration-submission.ts`
- Test: `src/club/__tests__/registration-number.test.ts` (append), `src/club/__tests__/number-allocator.test.ts`

**Interfaces:**
- Consumes: `formatRegistrationNumber(startYear, seq)`, `parseRegistrationNumber(value)` from `src/club/registration-number.ts`.
- Produces:
  - `nextRegistrationNumber(numbers: (string | null | undefined)[], startYear: number): string`
  - `MAX_NUMBER_RETRIES = 5` (1 attempt + up to 5 retries)
  - `class RegistrationNumberClashError extends Error { attempts: number }`
  - `type AllocatorDeps<T> = { readNumbers: (startYear: number) => Promise<(string | null)[]>; create: (registrationNumber: string) => Promise<T> }`
  - `isRegistrationNumberClash(err: unknown): boolean`
  - `allocateRegistrationNumber<T>(startYear: number, deps: AllocatorDeps<T>, maxRetries?: number): Promise<{ registrationNumber: string; result: T }>`
  - Strapi service `api::registration-submission.registration-submission` method `createNumbered(data: RegistrationData, startYear: number): Promise<NumberedRegistration>`, with exported types `RegistrationData = Modules.Documents.Params.Data.Input<'api::registration-submission.registration-submission'>` and `NumberedRegistration = { documentId: string; registrationNumber: string }`.

Rule (spec 1.2): next = highest sequence for that start year across ALL registrations (any season, any `season` text), plus 1. On a clash (database unique index, or Strapi's own unique check) the next number is tried. A retry never goes below the number that just clashed, even when the read is stale.

- [ ] **Step 1: Write the failing tests**

Append to `src/club/__tests__/registration-number.test.ts` (and add `nextRegistrationNumber` to its import list):

```ts
describe('nextRegistrationNumber', () => {
  it('continues after the highest number of that start year, whatever the season', () =>
    expect(nextRegistrationNumber(['2026-0007', '2025-0100', '2026-0003', null, 'junk'], 2026)).toBe('2026-0008'));
  it('starts at 0001 for a year with no numbers', () =>
    expect(nextRegistrationNumber(['2025-0100'], 2026)).toBe('2026-0001'));
  it('refuses to go past 9999', () =>
    expect(() => nextRegistrationNumber(['2026-9999'], 2026)).toThrow(RangeError));
});
```

`src/club/__tests__/number-allocator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  MAX_NUMBER_RETRIES,
  RegistrationNumberClashError,
  allocateRegistrationNumber,
  isRegistrationNumberClash,
} from '../number-allocator';

const pgClash = () =>
  Object.assign(new Error('duplicate key value violates unique constraint "registration_submissions_registration_number_uq"'), {
    code: '23505',
    constraint: 'registration_submissions_registration_number_uq',
  });

/** A fake table with a unique index on the number; create waits a tick like a real insert. */
function store(initial: string[] = [], staleReads = false) {
  const taken = new Set(initial);
  const calls: string[] = [];
  return {
    calls,
    readNumbers: async () => (staleReads ? [] : [...taken]),
    create: async (n: string) => {
      calls.push(n);
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (taken.has(n)) throw pgClash();
      taken.add(n);
      return { documentId: `doc-${n}` };
    },
  };
}

describe('allocateRegistrationNumber', () => {
  it('uses the next number after the highest of that start year', async () => {
    await expect(allocateRegistrationNumber(2026, store(['2026-0007', '2025-0100']))).resolves.toEqual({
      registrationNumber: '2026-0008',
      result: { documentId: 'doc-2026-0008' },
    });
  });

  it('gives two submits at the same moment two different numbers', async () => {
    const s = store(['2026-0007']);
    const [a, b] = await Promise.all([allocateRegistrationNumber(2026, s), allocateRegistrationNumber(2026, s)]);
    expect([a.registrationNumber, b.registrationNumber].sort()).toEqual(['2026-0008', '2026-0009']);
    expect(s.calls).toEqual(['2026-0008', '2026-0008', '2026-0009']);
  });

  it('moves past a clashing number even when the read is stale', async () => {
    const s = store(['2026-0001'], true);
    await expect(allocateRegistrationNumber(2026, s)).resolves.toMatchObject({ registrationNumber: '2026-0002' });
    expect(s.calls).toEqual(['2026-0001', '2026-0002']);
  });

  it('gives up after 1 attempt plus 5 retries', async () => {
    let calls = 0;
    const deps = {
      readNumbers: async () => [],
      create: async () => {
        calls += 1;
        throw pgClash();
      },
    };
    await expect(allocateRegistrationNumber(2026, deps)).rejects.toBeInstanceOf(RegistrationNumberClashError);
    expect(calls).toBe(MAX_NUMBER_RETRIES + 1);
  });

  it('does not retry other errors', async () => {
    let calls = 0;
    const deps = {
      readNumbers: async () => [],
      create: async () => {
        calls += 1;
        throw new Error('database down');
      },
    };
    await expect(allocateRegistrationNumber(2026, deps)).rejects.toThrow('database down');
    expect(calls).toBe(1);
  });
});

describe('isRegistrationNumberClash', () => {
  it('recognises the Postgres unique violation on the number', () => expect(isRegistrationNumberClash(pgClash())).toBe(true));

  it('ignores a Postgres unique violation on another column', () =>
    expect(isRegistrationNumberClash(Object.assign(new Error('dup'), { code: '23505', constraint: 'other_unique' }))).toBe(false));

  it('recognises the SQLite unique violation', () =>
    expect(
      isRegistrationNumberClash(new Error('UNIQUE constraint failed: registration_submissions.registration_number')),
    ).toBe(true));

  it("recognises Strapi's own unique check", () => {
    const err = Object.assign(new Error('This attribute must be unique'), {
      name: 'ValidationError',
      details: { errors: [{ path: ['registrationNumber'], message: 'This attribute must be unique' }] },
    });
    expect(isRegistrationNumberClash(err)).toBe(true);
  });

  it('is false for anything else', () => {
    expect(isRegistrationNumberClash(new Error('boom'))).toBe(false);
    expect(isRegistrationNumberClash(null)).toBe(false);
    expect(isRegistrationNumberClash('23505')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- src/club/__tests__/registration-number.test.ts src/club/__tests__/number-allocator.test.ts`
Expected: FAIL (`nextRegistrationNumber is not a function`, module `../number-allocator` not found).

- [ ] **Step 3: Implement the pure parts**

In `src/club/registration-number.ts`, after `parseRegistrationNumber`, add:

```ts
/** Highest sequence already used for `startYear` in any of `numbers` (any season), plus one. */
export function nextRegistrationNumber(numbers: (string | null | undefined)[], startYear: number): string {
  let max = 0;
  for (const value of numbers) {
    const parsed = parseRegistrationNumber(value);
    if (parsed && parsed.startYear === startYear) max = Math.max(max, parsed.seq);
  }
  return formatRegistrationNumber(startYear, max + 1);
}
```

`src/club/number-allocator.ts`:

```ts
import { formatRegistrationNumber, nextRegistrationNumber, parseRegistrationNumber } from './registration-number';

/** Retries after the first attempt when the number is taken (spec 1.2: "up to 5 times"). */
export const MAX_NUMBER_RETRIES = 5;

export class RegistrationNumberClashError extends Error {
  constructor(readonly attempts: number) {
    super(`No free registration number after ${attempts} attempts`);
    this.name = 'RegistrationNumberClashError';
  }
}

export type AllocatorDeps<T> = {
  /** Every registration number already starting with `<startYear>-`, in any season. */
  readNumbers: (startYear: number) => Promise<(string | null)[]>;
  /** Insert the registration with this number; must let the database or Strapi error through on a clash. */
  create: (registrationNumber: string) => Promise<T>;
};

type ErrorLike = {
  code?: unknown;
  constraint?: unknown;
  message?: unknown;
  name?: unknown;
  details?: { errors?: { path?: unknown; message?: unknown }[] };
};

const FIELD = 'registrationNumber';
const COLUMN = 'registration_number';

function isStrapiUniqueError(e: ErrorLike): boolean {
  const errors = Array.isArray(e.details?.errors) ? e.details.errors : [];
  return (
    e.name === 'ValidationError' &&
    errors.some((x) => Array.isArray(x.path) && x.path[0] === FIELD && /unique/i.test(String(x.message)))
  );
}

/** True when `err` says another registration already holds this number. */
export function isRegistrationNumberClash(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as ErrorLike;
  if (e.code === '23505') return String(e.constraint ?? e.message).includes(COLUMN);
  const message = typeof e.message === 'string' ? e.message : '';
  if (message.includes('UNIQUE constraint failed') && message.includes(COLUMN)) return true;
  return isStrapiUniqueError(e);
}

function nextCandidate(numbers: (string | null)[], startYear: number, lastTried: string | null): string {
  const fromRead = nextRegistrationNumber(numbers, startYear);
  const last = parseRegistrationNumber(lastTried);
  if (!last) return fromRead;
  const afterLast = formatRegistrationNumber(startYear, last.seq + 1);
  return afterLast > fromRead ? afterLast : fromRead;
}

/** Create a record under the next free number for `startYear`, retrying on a clash. */
export async function allocateRegistrationNumber<T>(
  startYear: number,
  deps: AllocatorDeps<T>,
  maxRetries = MAX_NUMBER_RETRIES,
): Promise<{ registrationNumber: string; result: T }> {
  let lastTried: string | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const registrationNumber = nextCandidate(await deps.readNumbers(startYear), startYear, lastTried);
    try {
      return { registrationNumber, result: await deps.create(registrationNumber) };
    } catch (err) {
      if (!isRegistrationNumberClash(err)) throw err;
      lastTried = registrationNumber;
    }
  }
  throw new RegistrationNumberClashError(maxRetries + 1);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -- src/club/__tests__/registration-number.test.ts src/club/__tests__/number-allocator.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the thin Strapi service**

Replace `src/api/registration-submission/services/registration-submission.ts` with:

```ts
import { factories } from '@strapi/strapi';
import type { Modules } from '@strapi/strapi';
import { allocateRegistrationNumber } from '../../../club/number-allocator';

const UID = 'api::registration-submission.registration-submission' as const;

/** Data for a new registration, without its number: the service assigns it. */
export type RegistrationData = Modules.Documents.Params.Data.Input<typeof UID>;
export type NumberedRegistration = { documentId: string; registrationNumber: string };

export default factories.createCoreService(UID, ({ strapi }) => ({
  /**
   * Create a registration under the next free number for the season start year.
   * `registrationNumber` has a database unique index; on a clash the next number is tried.
   */
  async createNumbered(data: RegistrationData, startYear: number): Promise<NumberedRegistration> {
    const { registrationNumber, result } = await allocateRegistrationNumber(startYear, {
      readNumbers: async (year) => {
        const rows: { registrationNumber?: string | null }[] = await strapi.db.query(UID).findMany({
          select: ['registrationNumber'],
          where: { registrationNumber: { $startsWith: `${year}-` } },
        });
        return rows.map((r) => r.registrationNumber ?? null);
      },
      create: (registrationNumber) => strapi.documents(UID).create({ data: { ...data, registrationNumber } }),
    });
    return { documentId: result.documentId, registrationNumber };
  },
}));
```

- [ ] **Step 6: Type-check and run everything**

Run: `npx tsc --noEmit` (zero errors) and `npm test` (all PASS). The service is exercised end to end in Task 11 (five parallel submits).

- [ ] **Step 7: Commit**

```bash
git add src/club/registration-number.ts src/club/number-allocator.ts \
  src/club/__tests__/registration-number.test.ts src/club/__tests__/number-allocator.test.ts \
  src/api/registration-submission/services/registration-submission.ts
git commit -m "feat(club): allocate registration numbers at submit with retry on clash"
```

---

### Task 6: Public read endpoint

**Files:**
- Create: `src/club/public-info.ts`, `src/club/public-info-loader.ts`
- Create: `src/api/club/routes/01-public.ts`
- Modify: `src/api/club/controllers/club.ts` (add `publicInfo`)
- Test: `src/club/__tests__/public-info.test.ts`, `src/club/__tests__/club-routes.test.ts`

**Interfaces:**
- Consumes: Task 3 (`asText`, `asTextList`, `isIncomplete`, `isPrice`, `isPriceItemKind`, `offeredItems`, `priceFor`, `Audience`, `PriceItemKind`); Task 4 (`CurrentSeason`, `findCurrentSeason`).
- Produces (`src/club/public-info.ts`):
  - `type PublicPriceItem = { name: string; kind: PriceItemKind; sessions: number | null; memberPrice: number | null; nonMemberPrice: number | null; tooltip: string | null }`
  - `type PublicPriceList = { name: string; items: PublicPriceItem[] }`
  - `type PublicSchool = { name: string; slug: string; priceLists: PublicPriceList[]; priceNotes: string[] }`
  - `type PublicSeason = { label: string; startMonth: string; endMonth: string }`
  - `type PublicClubInfo = { season: PublicSeason | null; membershipFee: number | null; schools: PublicSchool[] }`
  - `type SubscriptionChoice = { priceItemName: string; price: number; member: boolean }`
  - `type RawPriceItem`, `type RawPriceList`, `type RawSection = { documentId?: unknown; name?: unknown; slug?: unknown; kind?: unknown; publicPage?: unknown; order?: unknown; priceNotes?: unknown }`
  - `toPublicItem(raw: RawPriceItem): PublicPriceItem | null` (null for an incomplete item)
  - `buildPublicSchools(sections: RawSection[], lists: RawPriceList[]): PublicSchool[]` (only sections with `kind = 'school'` and `publicPage = true`; lists keep the order given; the loader sorts by `createdAt`)
  - `buildPublicClubInfo(season: CurrentSeason | null, schools: PublicSchool[]): PublicClubInfo`
  - `resolveSubscriptionChoice(school: PublicSchool, priceItemName: string, member: boolean): SubscriptionChoice | null`
- Produces (`src/club/public-info-loader.ts`): `loadPublicClubInfo(strapi: Core.Strapi): Promise<PublicClubInfo>`, `loadSchoolPrices(strapi: Core.Strapi, sectionDocumentId: string): Promise<PublicSchool | null>`.
- Produces (HTTP): `GET /api/club/public`, unauthenticated, `Cache-Control: public, max-age=60`, body `{ data: PublicClubInfo }`.

What the response carries (spec 3.1): current season label and period, the membership fee (the member price box shows it), and per school (a section with `kind = 'school'` and `publicPage = true`; Club never, even with a public page, cross-plan ruling 2026-10-21): name, slug, every price list of the section with its items that have at least one price (a list left with no such item is omitted), and `priceNotes`. Each item carries both prices (null when missing); the frontend picks per audience with `offeredItems(items, audience)`: members see items with `memberPrice`, non-members items with `nonMemberPrice`. No `documentId`, no `id`, no `included`, no location, no timestamps. `slug` is the only identifier the frontend needs (`?scoala=<slug>`). The season period and fee are returned even when there are no schools; schools are returned even when there is no current season (the Cursuri page still shows prices; the form reads `season: null` as "closed").

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/public-info.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CurrentSeason } from '../current-season';
import {
  buildPublicClubInfo,
  buildPublicSchools,
  resolveSubscriptionChoice,
  type PublicSchool,
} from '../public-info';

const TOOLTIP_6 = 'Disponibil pentru cei care știu că vor lipsi un weekend din cele 4 aferente abonamentului.';

const season: CurrentSeason = {
  documentId: 'season-doc',
  label: '2026-2027',
  startMonth: '2026-10-01',
  endMonth: '2027-05-31',
  membershipFee: 250,
};

// Rows shaped like Strapi documents, stuffed with fields that must never reach the public.
const school = {
  id: 3,
  documentId: 'sec-school',
  name: 'Școala de Patinaj - AFI Cotroceni',
  kind: 'school',
  slug: 'afi-cotroceni',
  order: 1,
  publicPage: true,
  registrationsOpen: true,
  priceNotes: ['Nota 1', '', 7, 'Nota 2'],
  location: { address: 'Bd. Vasile Milea' },
  createdAt: '2026-10-01T00:00:00.000Z',
};
// Club has a public page on purpose: it must still never appear.
const club = { id: 4, documentId: 'sec-club', name: 'Club', kind: 'club', slug: 'club', order: 0, publicPage: true, registrationsOpen: false, priceNotes: ['Notă club'] };
const hiddenSchool = { documentId: 'sec-hidden', name: 'Școală fără pagină', kind: 'school', slug: 'ascunsa', order: 3, publicPage: false, priceNotes: null };
const item = (over: Record<string, unknown>) => ({
  id: 11,
  name: 'Abonament 8 ședințe grup',
  kind: 'subscription',
  sessions: 8,
  memberPrice: 590,
  nonMemberPrice: 790,
  included: true,
  tooltip: null,
  ...over,
});
const standard = {
  id: 1,
  documentId: 'list-standard',
  name: 'Standard',
  section: { id: 3, documentId: 'sec-school' },
  items: [
    item({ name: 'Abonament 6 ședințe grup', sessions: 6, memberPrice: 520, nonMemberPrice: 720, tooltip: TOOLTIP_6 }),
    item({}),
    item({ name: '1 ședință grup', kind: 'session', sessions: null, memberPrice: null, nonMemberPrice: 150, tooltip: 'Disponibil doar pentru prima ședință' }),
    item({ name: 'Fără preț', memberPrice: null, nonMemberPrice: null }),
  ],
};
// Test value; the real Avansați Gold price is entered later in the Prețuri screen.
const gold = {
  documentId: 'list-gold',
  name: 'Avansați Gold',
  section: { documentId: 'sec-school' },
  items: [item({ name: 'Abonament Avansați Gold 8 ședințe', memberPrice: 600, nonMemberPrice: null })],
};
const noPrices = { documentId: 'list-empty', name: 'Fără prețuri', section: { documentId: 'sec-school' }, items: [item({ memberPrice: null, nonMemberPrice: null })] };
const otherSection = { documentId: 'list-other', name: 'Altă secțiune', section: { documentId: 'sec-hidden' }, items: [item({})] };
const clubList = { documentId: 'list-club', name: 'Club', section: { documentId: 'sec-club' }, items: [item({ name: 'Antrenament club' })] };

const schools = () => buildPublicSchools([club, school, hiddenSchool], [standard, gold, noPrices, otherSection, clubList]);

describe('buildPublicSchools', () => {
  it('builds the public view of each section with every list and its priced items', () => {
    expect(schools()).toEqual([
      {
        name: 'Școala de Patinaj - AFI Cotroceni',
        slug: 'afi-cotroceni',
        priceNotes: ['Nota 1', 'Nota 2'],
        priceLists: [
          {
            name: 'Standard',
            items: [
              { name: 'Abonament 6 ședințe grup', kind: 'subscription', sessions: 6, memberPrice: 520, nonMemberPrice: 720, tooltip: TOOLTIP_6 },
              { name: 'Abonament 8 ședințe grup', kind: 'subscription', sessions: 8, memberPrice: 590, nonMemberPrice: 790, tooltip: null },
              { name: '1 ședință grup', kind: 'session', sessions: null, memberPrice: null, nonMemberPrice: 150, tooltip: 'Disponibil doar pentru prima ședință' },
            ],
          },
          {
            name: 'Avansați Gold',
            items: [
              { name: 'Abonament Avansați Gold 8 ședințe', kind: 'subscription', sessions: 8, memberPrice: 600, nonMemberPrice: null, tooltip: null },
            ],
          },
        ],
      },
    ]);
  });

  it('never lists Club, even with a public page, nor a school without a public page', () => {
    expect(schools().map((x) => x.slug)).toEqual(['afi-cotroceni']);
    expect(JSON.stringify(schools())).not.toMatch(/Club|Antrenament club|Notă club|ascunsa/);
  });

  it('leaks no private field', () => {
    const json = JSON.stringify(buildPublicClubInfo(season, schools()));
    expect(json).not.toMatch(/documentId|"id"|included|createdAt|location|publicPage|registrationsOpen|season-doc|sec-school|list-|Altă secțiune/);
    const first = schools()[0];
    expect(Object.keys(first).sort()).toEqual(['name', 'priceLists', 'priceNotes', 'slug']);
    expect(Object.keys(first.priceLists[0]).sort()).toEqual(['items', 'name']);
    expect(Object.keys(first.priceLists[0].items[0]).sort()).toEqual(['kind', 'memberPrice', 'name', 'nonMemberPrice', 'sessions', 'tooltip']);
  });

  it('drops sections without a usable name, slug or documentId', () => {
    const base = { kind: 'school', publicPage: true };
    expect(
      buildPublicSchools([{ ...base, name: 'Fără slug', documentId: 'x' }, { ...base, slug: 'fara-nume', documentId: 'y' }, { ...base, name: 'Fără id', slug: 'fara-id' }], []),
    ).toEqual([]);
  });

  it('orders schools by their order field, then by name', () => {
    const two = { ...school, documentId: 'sec-two', name: 'Alta', slug: 'alta', order: 0 };
    expect(buildPublicSchools([school, two], []).map((x) => x.slug)).toEqual(['alta', 'afi-cotroceni']);
  });

  it('shows every list of the section; drops incomplete items and lists left empty', () => {
    expect(schools()[0].priceLists.map((l) => l.name)).toEqual(['Standard', 'Avansați Gold']);
    expect(JSON.stringify(schools())).not.toContain('Fără pre');
  });
});

describe('buildPublicClubInfo', () => {
  it('returns the season period and fee without internal ids', () => {
    const info = buildPublicClubInfo(season, []);
    expect(info).toEqual({ season: { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31' }, membershipFee: 250, schools: [] });
  });

  it('still lists prices when there is no current season', () => {
    const info = buildPublicClubInfo(null, schools());
    expect(info.season).toBeNull();
    expect(info.membershipFee).toBeNull();
    expect(info.schools).toHaveLength(1);
  });
});

describe('resolveSubscriptionChoice', () => {
  const view: PublicSchool = schools()[0];

  it('freezes the member price for a member', () =>
    expect(resolveSubscriptionChoice(view, 'Abonament 8 ședințe grup', true)).toEqual({
      priceItemName: 'Abonament 8 ședințe grup',
      price: 590,
      member: true,
    }));

  it('freezes the non-member price for a non-member', () =>
    expect(resolveSubscriptionChoice(view, ' 1 ședință grup ', false)).toEqual({ priceItemName: '1 ședință grup', price: 150, member: false }));

  it('refuses an item not offered to members', () => expect(resolveSubscriptionChoice(view, '1 ședință grup', true)).toBeNull());

  it('offers the member-only Gold item to members only', () => {
    expect(resolveSubscriptionChoice(view, 'Abonament Avansați Gold 8 ședințe', true)).toEqual({
      priceItemName: 'Abonament Avansați Gold 8 ședințe',
      price: 600,
      member: true,
    });
    expect(resolveSubscriptionChoice(view, 'Abonament Avansați Gold 8 ședințe', false)).toBeNull();
  });

  it('refuses an unknown or incomplete item', () => {
    expect(resolveSubscriptionChoice(view, 'Abonament 99 ședințe', false)).toBeNull();
    expect(resolveSubscriptionChoice(view, 'Fără preț', false)).toBeNull();
  });
});
```

`src/club/__tests__/club-routes.test.ts`:

```ts
import { expect, it } from 'vitest';
import adminRoutes from '../../api/club/routes/02-admin';
import publicRoutes from '../../api/club/routes/01-public';

it('serves the public read without auth', () => {
  expect(publicRoutes.routes).toEqual([
    { method: 'GET', path: '/club/public', handler: 'club.publicInfo', config: { auth: false, policies: [], middlewares: [] } },
  ]);
});

it('keeps the summary admin-only', () => {
  expect(adminRoutes.routes[0].config.policies).toEqual(['global::is-admin']);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- src/club/__tests__/public-info.test.ts src/club/__tests__/club-routes.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the builders**

`src/club/public-info.ts`:

```ts
import type { CurrentSeason } from './current-season';
import { asText, asTextList } from './narrow';
import { isIncomplete, isPrice, isPriceItemKind, offeredItems, priceFor, type Audience, type PriceItemKind } from './price-item';

export type PublicPriceItem = {
  name: string;
  kind: PriceItemKind;
  sessions: number | null;
  memberPrice: number | null;
  nonMemberPrice: number | null;
  tooltip: string | null;
};
export type PublicPriceList = { name: string; items: PublicPriceItem[] };
export type PublicSchool = { name: string; slug: string; priceLists: PublicPriceList[]; priceNotes: string[] };
export type PublicSeason = { label: string; startMonth: string; endMonth: string };
export type PublicClubInfo = { season: PublicSeason | null; membershipFee: number | null; schools: PublicSchool[] };
/** Frozen on the registration at submit (spec 1.1). */
export type SubscriptionChoice = { priceItemName: string; price: number; member: boolean };

export type RawPriceItem = { name?: unknown; kind?: unknown; sessions?: unknown; memberPrice?: unknown; nonMemberPrice?: unknown; tooltip?: unknown };
export type RawPriceList = { name?: unknown; section?: { documentId?: unknown } | null; items?: unknown };
export type RawSection = {
  documentId?: unknown;
  name?: unknown;
  slug?: unknown;
  kind?: unknown;
  publicPage?: unknown;
  order?: unknown;
  priceNotes?: unknown;
};

/** The public view of one price item, or null when it has no usable name, kind or any price. */
export function toPublicItem(raw: RawPriceItem): PublicPriceItem | null {
  const name = asText(raw.name);
  if (!name || !isPriceItemKind(raw.kind)) return null;
  const item: PublicPriceItem = {
    name,
    kind: raw.kind,
    sessions: typeof raw.sessions === 'number' && Number.isInteger(raw.sessions) ? raw.sessions : null,
    memberPrice: isPrice(raw.memberPrice) ? raw.memberPrice : null,
    nonMemberPrice: isPrice(raw.nonMemberPrice) ? raw.nonMemberPrice : null,
    tooltip: asText(raw.tooltip) || null,
  };
  return isIncomplete(item) ? null : item;
}

function publicItems(items: unknown): PublicPriceItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw: RawPriceItem) => toPublicItem(raw)).filter((i): i is PublicPriceItem => i !== null);
}

/** Every list of each section, in the order given, with its priced items; lists left empty are dropped. */
function listsBySection(lists: RawPriceList[]): Map<string, PublicPriceList[]> {
  const out = new Map<string, PublicPriceList[]>();
  for (const list of lists) {
    const sectionId = list.section?.documentId;
    const items = publicItems(list.items);
    if (typeof sectionId !== 'string' || items.length === 0) continue;
    out.set(sectionId, [...(out.get(sectionId) ?? []), { name: asText(list.name), items }]);
  }
  return out;
}

const sectionRank = (s: RawSection) => (typeof s.order === 'number' ? s.order : Number.MAX_SAFE_INTEGER);

function bySectionOrder(a: RawSection, b: RawSection): number {
  return sectionRank(a) - sectionRank(b) || asText(a.name).localeCompare(asText(b.name), 'ro');
}

/** Website and form schools: `kind = 'school'` with a public page. Club never, even with a public page. */
const isPublicSchool = (s: RawSection) => s.kind === 'school' && s.publicPage === true;

function toPublicSchool(s: RawSection, lists: Map<string, PublicPriceList[]>): PublicSchool | null {
  const name = asText(s.name);
  const slug = asText(s.slug);
  if (typeof s.documentId !== 'string' || !name || !slug) return null;
  const priceLists = lists.get(s.documentId) ?? [];
  return { name, slug, priceLists, priceNotes: asTextList(s.priceNotes) };
}

export function buildPublicSchools(sections: RawSection[], lists: RawPriceList[]): PublicSchool[] {
  const bySection = listsBySection(lists);
  return sections
    .filter(isPublicSchool)
    .sort(bySectionOrder)
    .map((s) => toPublicSchool(s, bySection))
    .filter((s): s is PublicSchool => s !== null);
}

export function buildPublicClubInfo(season: CurrentSeason | null, schools: PublicSchool[]): PublicClubInfo {
  return {
    season: season ? { label: season.label, startMonth: season.startMonth, endMonth: season.endMonth } : null,
    membershipFee: season?.membershipFee ?? null,
    schools,
  };
}

/** The chosen item with its price for this audience, from the server's lists; null when not offered. */
export function resolveSubscriptionChoice(school: PublicSchool, priceItemName: string, member: boolean): SubscriptionChoice | null {
  const audience: Audience = member ? 'member' : 'nonMember';
  const wanted = priceItemName.trim();
  const item = offeredItems(school.priceLists.flatMap((l) => l.items), audience).find((i) => i.name === wanted);
  const price = item ? priceFor(item, audience) : null;
  return item && price !== null ? { priceItemName: item.name, price, member } : null;
}
```

- [ ] **Step 4: Run the builder tests to see them pass**

Run: `npm test -- src/club/__tests__/public-info.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the loader, route and controller**

`src/club/public-info-loader.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { findCurrentSeason } from './current-season';
import { buildPublicClubInfo, buildPublicSchools, type PublicClubInfo, type PublicSchool } from './public-info';

async function loadLists(strapi: Core.Strapi, sectionIds: string[]) {
  if (sectionIds.length === 0) return [];
  return strapi.documents('api::price-list.price-list').findMany({
    filters: { section: { documentId: { $in: sectionIds } } },
    populate: { items: true, section: { fields: ['documentId'] } },
    sort: 'createdAt:asc',
    limit: 200,
  });
}

/** Everything GET /api/club/public returns: current season, fee, school sections with a public page. */
export async function loadPublicClubInfo(strapi: Core.Strapi): Promise<PublicClubInfo> {
  const [season, sections] = await Promise.all([
    findCurrentSeason(strapi),
    strapi.documents('api::section.section').findMany({ filters: { kind: 'school', publicPage: true }, limit: 100 }),
  ]);
  const lists = await loadLists(strapi, sections.map((s) => s.documentId));
  return buildPublicClubInfo(season, buildPublicSchools(sections, lists));
}

/** The prices the form offers for one school (the one `pickSchool` chose: a school with a public page). */
export async function loadSchoolPrices(strapi: Core.Strapi, sectionDocumentId: string): Promise<PublicSchool | null> {
  const section = await strapi.documents('api::section.section').findOne({ documentId: sectionDocumentId });
  const sections = section ? [section] : [];
  const lists = await loadLists(strapi, sections.map((s) => s.documentId));
  return buildPublicSchools(sections, lists)[0] ?? null;
}
```

`src/api/club/routes/01-public.ts`:

```ts
/**
 * Public, read-only club data for the website and the registration form:
 * current season, membership fee and public prices. No private data.
 * Auth is disabled, as for the public form routes.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/club/public',
      handler: 'club.publicInfo',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
```

In `src/api/club/controllers/club.ts`, add the import under the existing one:

```ts
import { loadPublicClubInfo } from '../../../club/public-info-loader';
```

and add this method after `summary`:

```ts
  /** GET /api/club/public (no auth): see src/club/public-info.ts for exactly what is returned. */
  async publicInfo(ctx) {
    ctx.set('Cache-Control', 'public, max-age=60');
    ctx.body = { data: await loadPublicClubInfo(strapi) };
  },
```

- [ ] **Step 6: Run the tests and type-check**

Run: `npm test` (all PASS, including `club-routes.test.ts`) and `npx tsc --noEmit` (zero errors).

- [ ] **Step 7: Commit**

```bash
git add src/club/public-info.ts src/club/public-info-loader.ts src/api/club/routes/01-public.ts \
  src/api/club/controllers/club.ts src/club/__tests__/public-info.test.ts src/club/__tests__/club-routes.test.ts
git commit -m "feat(club): public read of season, membership fee and public prices"
```

---

### Task 7: Registration input and rules

**Files:**
- Create: `src/club/registration-input.ts`
- Test: `src/club/__tests__/registration-input.test.ts`

**Interfaces:**
- Consumes: Task 2 (`RELATIONSHIP_OTHER`, `SOURCE_OTHER`, `isRelationship`, `isMembershipAnswer`, the option lists and the registry `inscriere`); Task 1 (schema enums, read by the test).
- Produces:
  - `MAX_TEXT = 5000`, `CHILD_HEIGHT_CM = { min: 50, max: 230 }`
  - `type RegistrationInput` (fields below; all strings trimmed, consents boolean; a body `extra` is never read)
  - `readRegistrationInput(body: Record<string, unknown>): RegistrationInput` (request contract: `subscriptionChoice: { priceItemName }`; any client `price` or `member` is never read)
  - `presenceValues(input): Record<string, string>` (registry key -> value, checked against `effectiveRequired`)
  - `selectValues(input): Record<string, string>` (`relationship`, `lastSeason`, `membershipAnswer`, `source`, checked by `validateBuiltinSelects`)
  - `parseChildHeight(raw: string): number | null`
  - `RULE_ERRORS` (Romanian messages), `checkRegistrationRules(input, isRequired: (key: string) => boolean): string | null`

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/registration-input.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { questionMap } from '../../api/form-config/registry';
import { MEMBERSHIP_OPTIONS, RELATIONSHIP_OPTIONS, SOURCE_OPTIONS, SOURCE_OTHER, LAST_SEASON_OPTIONS } from '../registration-form-options';
import {
  MAX_TEXT,
  RULE_ERRORS,
  checkRegistrationRules,
  parseChildHeight,
  presenceValues,
  readRegistrationInput,
  selectValues,
} from '../registration-input';

const BODY = {
  email: ' ana.pop@example.com ',
  parentName: 'Ana Pop',
  relationship: 'parinte',
  phone: '0712345678',
  childName: 'Maria Pop',
  childBirthDate: '14.03.2016',
  childHeight: 132,
  shirtSize: 'S',
  lastSeason: LAST_SEASON_OPTIONS[0],
  priorExperience: 'Nu este cazul',
  expectations: 'Să învețe să patineze',
  membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: ' Abonament 8 ședințe grup ', price: 1, member: false },
  source: SOURCE_OPTIONS[0],
  gdprConsent: true,
  regulationsConsent: 'true',
  website: '',
};
const always = () => true;

describe('readRegistrationInput', () => {
  it('reads and trims the answers; takes only the item name from the choice', () => {
    const input = readRegistrationInput(BODY);
    expect(input).toMatchObject({ email: 'ana.pop@example.com', childHeight: '132', priceItemName: 'Abonament 8 ședințe grup', gdprConsent: true, regulationsConsent: true });
    expect(JSON.stringify(input)).not.toContain('"price"');
  });

  it('treats non-strings as empty and cuts long text', () => {
    const input = readRegistrationInput({ email: 7, expectations: 'x'.repeat(MAX_TEXT + 10), subscriptionChoice: 'Abonament' });
    expect(input.email).toBe('');
    expect(input.expectations).toHaveLength(MAX_TEXT);
    expect(input.priceItemName).toBe('');
    expect(input.gdprConsent).toBe(false);
  });
});

describe('registry alignment', () => {
  const registry = questionMap('inscriere');

  it('every presence key is a registry question', () => {
    for (const key of Object.keys(presenceValues(readRegistrationInput(BODY)))) expect(registry[key]).toBeDefined();
  });

  it('select values are exactly the registry selects with fixed options', () => {
    expect(Object.keys(selectValues(readRegistrationInput(BODY))).sort()).toEqual(['lastSeason', 'membershipAnswer', 'relationship', 'source']);
  });

  it('stored enum values match the schema', () => {
    const schema = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'api', 'registration-submission', 'content-types', 'registration-submission', 'schema.json'), 'utf8'),
    );
    expect(schema.attributes.relationship.enum).toEqual(RELATIONSHIP_OPTIONS.map((o) => o.value));
    expect(schema.attributes.membershipAnswer.enum).toEqual(MEMBERSHIP_OPTIONS.map((o) => o.value));
  });
});

describe('parseChildHeight', () => {
  it('accepts whole centimetres in range', () => {
    expect(parseChildHeight('132')).toBe(132);
    expect(parseChildHeight('50')).toBe(50);
    expect(parseChildHeight('230')).toBe(230);
  });
  it('rejects anything else', () => {
    for (const raw of ['49', '231', '13a', '1.32', '', '1320']) expect(parseChildHeight(raw)).toBeNull();
  });
});

describe('checkRegistrationRules', () => {
  const input = (over: Record<string, unknown>) => readRegistrationInput({ ...BODY, ...over });

  it('passes a complete answer set', () => expect(checkRegistrationRules(input({}), always)).toBeNull());

  it('asks for the relationship text with Alta', () => {
    expect(checkRegistrationRules(input({ relationship: 'alta' }), always)).toBe(RULE_ERRORS.relationshipOther);
    expect(checkRegistrationRules(input({ relationship: 'alta', relationshipOther: 'Bunic' }), always)).toBeNull();
  });

  it('asks for the source text with Altele', () => {
    expect(checkRegistrationRules(input({ source: SOURCE_OTHER }), always)).toBe(RULE_ERRORS.sourceOther);
    expect(checkRegistrationRules(input({ source: SOURCE_OTHER, sourceOther: 'Ziar' }), always)).toBeNull();
  });

  it('rejects an impossible height', () => expect(checkRegistrationRules(input({ childHeight: '13' }), always)).toBe(RULE_ERRORS.childHeight));

  it('rejects values outside the stored enums', () => {
    expect(checkRegistrationRules(input({ relationship: 'Părinte' }), always)).toBe(RULE_ERRORS.choice);
    expect(checkRegistrationRules(input({ membershipAnswer: 'Da' }), always)).toBe(RULE_ERRORS.choice);
  });

  it('requires both consents while they are required', () => {
    expect(checkRegistrationRules(input({ gdprConsent: false }), always)).toBe(RULE_ERRORS.gdprConsent);
    expect(checkRegistrationRules(input({ regulationsConsent: false }), always)).toBe(RULE_ERRORS.regulationsConsent);
    expect(checkRegistrationRules(input({ gdprConsent: false }), (key) => key !== 'gdprConsent')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npm test -- src/club/__tests__/registration-input.test.ts`
Expected: FAIL (module `../registration-input` not found).

- [ ] **Step 3: Implement**

`src/club/registration-input.ts`:

```ts
import { RELATIONSHIP_OTHER, SOURCE_OTHER, isMembershipAnswer, isRelationship } from './registration-form-options';

export const MAX_TEXT = 5000;
export const CHILD_HEIGHT_CM = { min: 50, max: 230 } as const;

export type RegistrationInput = {
  website: string;
  email: string;
  phone: string;
  parentName: string;
  relationship: string;
  relationshipOther: string;
  childName: string;
  childBirthDate: string;
  childHeight: string;
  shirtSize: string;
  lastSeason: string;
  priorExperience: string;
  expectations: string;
  membershipAnswer: string;
  priceItemName: string;
  source: string;
  sourceOther: string;
  gdprConsent: boolean;
  regulationsConsent: boolean;
};

export const RULE_ERRORS = {
  relationshipOther: 'Specificați calitatea față de sportiv.',
  sourceOther: 'Specificați de unde ați aflat de noi.',
  childHeight: 'Înălțimea copilului nu este validă.',
  choice: 'Valoare invalidă.',
  gdprConsent: 'Acordul GDPR este obligatoriu.',
  regulationsConsent: 'Acordul Regulament este obligatoriu.',
} as const;

const text = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '');
const numberOrText = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? String(v) : text(v));
const yes = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';

/** Only the item name is read from `subscriptionChoice`; price and membership are decided by the server. */
function choiceName(v: unknown): string {
  return v && typeof v === 'object' ? text((v as { priceItemName?: unknown }).priceItemName) : '';
}

export function readRegistrationInput(body: Record<string, unknown>): RegistrationInput {
  return {
    website: text(body.website),
    email: text(body.email),
    phone: text(body.phone),
    parentName: text(body.parentName),
    relationship: text(body.relationship),
    relationshipOther: text(body.relationshipOther),
    childName: text(body.childName),
    childBirthDate: text(body.childBirthDate),
    childHeight: numberOrText(body.childHeight),
    shirtSize: text(body.shirtSize),
    lastSeason: text(body.lastSeason),
    priorExperience: text(body.priorExperience),
    expectations: text(body.expectations),
    membershipAnswer: text(body.membershipAnswer),
    priceItemName: choiceName(body.subscriptionChoice),
    source: text(body.source),
    sourceOther: text(body.sourceOther),
    gdprConsent: yes(body.gdprConsent),
    regulationsConsent: yes(body.regulationsConsent),
  };
}

/** Answers checked for presence against the form-config required map, by registry key. */
export function presenceValues(i: RegistrationInput): Record<string, string> {
  return {
    email: i.email,
    phone: i.phone,
    parentName: i.parentName,
    relationship: i.relationship,
    childName: i.childName,
    childBirthDate: i.childBirthDate,
    childHeight: i.childHeight,
    shirtSize: i.shirtSize,
    lastSeason: i.lastSeason,
    priorExperience: i.priorExperience,
    expectations: i.expectations,
    membershipAnswer: i.membershipAnswer,
    subscriptionChoice: i.priceItemName,
    source: i.source,
  };
}

/** Select answers validated against the registry options by form-config `validateBuiltinSelects`. */
export function selectValues(i: RegistrationInput): Record<string, string> {
  return { relationship: i.relationship, lastSeason: i.lastSeason, membershipAnswer: i.membershipAnswer, source: i.source };
}

export function parseChildHeight(raw: string): number | null {
  if (!/^\d{2,3}$/.test(raw)) return null;
  const cm = Number(raw);
  return cm >= CHILD_HEIGHT_CM.min && cm <= CHILD_HEIGHT_CM.max ? cm : null;
}

function enumError(i: RegistrationInput): string | null {
  if (i.relationship && !isRelationship(i.relationship)) return RULE_ERRORS.choice;
  if (i.membershipAnswer && !isMembershipAnswer(i.membershipAnswer)) return RULE_ERRORS.choice;
  return null;
}

function otherTextError(i: RegistrationInput): string | null {
  if (i.relationship === RELATIONSHIP_OTHER && !i.relationshipOther) return RULE_ERRORS.relationshipOther;
  if (i.source === SOURCE_OTHER && !i.sourceOther) return RULE_ERRORS.sourceOther;
  return null;
}

function consentError(i: RegistrationInput, isRequired: (key: string) => boolean): string | null {
  if (isRequired('gdprConsent') && !i.gdprConsent) return RULE_ERRORS.gdprConsent;
  if (isRequired('regulationsConsent') && !i.regulationsConsent) return RULE_ERRORS.regulationsConsent;
  return null;
}

/** Rules the form-config registry cannot express: follow-up texts, height, stored enums, consents. */
export function checkRegistrationRules(i: RegistrationInput, isRequired: (key: string) => boolean): string | null {
  if (i.childHeight && parseChildHeight(i.childHeight) === null) return RULE_ERRORS.childHeight;
  return enumError(i) ?? otherTextError(i) ?? consentError(i, isRequired);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/club/__tests__/registration-input.test.ts`
Expected: PASS. Then `npx tsc --noEmit`: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/registration-input.ts src/club/__tests__/registration-input.test.ts
git commit -m "feat(club): read and check the script form answers"
```

---

### Task 8: Copy planners

**Files:**
- Create: `src/club/migrate/registration-copy.ts`
- Test: `src/club/__tests__/registration-copy.test.ts`

**Interfaces:**
- Consumes: `nameKey`, `parsePrice` (`src/club/migrate/names.ts`); `normalizeSeasonLabel` (`src/club/season.ts`); `asText`, `asTextList` (Task 3); `CurrentSeason` (Task 4, type only).
- Produces:
  - `type LegacyTier = { label?: unknown; price?: unknown; tooltip?: unknown; note?: unknown }`, `type LegacyTiers = { memberTiers?: LegacyTier[]; nonMemberTiers?: LegacyTier[]; memberFeePrice?: unknown }`
  - `type ItemForCopy = { name: string; tooltip?: string | null } & Record<string, unknown>`, `type PriceListForCopy = { documentId: string; name: string; items: ItemForCopy[] }`
  - `planTooltipCopy(input: { tiers: LegacyTiers; lists: PriceListForCopy[] }): TooltipPlan` where `TooltipPlan = { updates: { documentId: string; name: string; items: ItemForCopy[]; filled: string[] }[]; unmatched: string[]; droppedNotes: string[]; conflicts: string[] }`
  - `planPriceNotesCopy(input: { footerNotes: unknown; sections: SectionForNotes[] }): { update: { documentId: string; priceNotes: string[] } | null; report: string[] }`, `type SectionForNotes = { documentId: string; name: string; kind?: unknown; priceNotes?: unknown }`
  - `checkSeasonAgainstLegacy(input: { season: CurrentSeason | null; settings: LegacySeasonSettings; memberFeePrice: unknown }): string[]`, `type LegacySeasonSettings = { currentSeason?: unknown; seasonStartDate?: unknown; seasonEndDate?: unknown }`
  - `planSchoolPublicPage(sections: SectionForPage[]): { update: { documentId: string; name: string } | null; report: string[] }`, `type SectionForPage = { documentId: string; name: string; kind?: unknown; publicPage?: unknown }`
  - `planCustomQuestionRemoval(overlay: unknown): { removed: string[]; overlay: Record<string, unknown> | null }`

Rules (spec 1.5): tooltips match price items by name (`nameKey`: case, spaces and diacritics ignored, any list); a tier note becomes the tooltip when the tier has no tooltip (so "Disponibil doar pentru prima ședință" becomes the tooltip of "1 ședință grup"); a note next to a tooltip is reported as dropped. Only empty values are filled, so a second run changes nothing and an admin's later edit is never overwritten. Season period and fee are reported, never written.

Also (user rulings): the single school section (`kind = 'school'`, the Școala de patinaj, public page /cursuri today) gets `publicPage = true` so it becomes the registration target and appears in the public read; and the custom (extra) questions of the `inscriere` form config are removed, together with their places in the step order (user decision 2026-10-03). Built-in label overrides in the overlay stay. Registrations and their stored `extra` answers are never touched.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/registration-copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  checkSeasonAgainstLegacy,
  planCustomQuestionRemoval,
  planPriceNotesCopy,
  planSchoolPublicPage,
  planTooltipCopy,
} from '../migrate/registration-copy';

const TOOLTIP_6 = 'Disponibil pentru cei care știu că vor lipsi un weekend din cele 4 aferente abonamentului.';
// Shape of the live pricing.tiers (scripts/seed-pricing.js).
const tiers = {
  memberTiers: [
    { label: 'Abonament 6 ședințe grup', price: '520 RON', tooltip: TOOLTIP_6 },
    { label: 'Abonament 8 ședințe grup', price: '590 RON' },
  ],
  nonMemberTiers: [
    { label: '1 ședință grup', price: '150 RON', note: 'Disponibil doar pentru prima ședință' },
    { label: 'Abonament 6 ședințe grup', price: '720 RON', tooltip: TOOLTIP_6 },
    { label: 'Abonament 8 ședințe grup', price: '790 RON' },
  ],
  memberFeeLabel: 'Taxa de membru (o dată/sezon)',
  memberFeePrice: '250 RON',
};
const standard = () => ({
  documentId: 'list-standard',
  name: 'Standard',
  items: [
    { id: 1, name: 'Abonament 6 ședințe grup', kind: 'subscription', sessions: 6, memberPrice: 520, nonMemberPrice: 720, tooltip: null },
    { id: 2, name: 'Abonament 8 ședințe grup', kind: 'subscription', sessions: 8, memberPrice: 590, nonMemberPrice: 790, tooltip: null },
    { id: 3, name: '1 ședință grup', kind: 'session', sessions: null, memberPrice: null, nonMemberPrice: 150, tooltip: null },
  ],
});
const gold = () => ({ documentId: 'list-gold', name: 'Avansați Gold', items: [{ id: 4, name: 'Abonament Avansați Gold 8 ședințe', tooltip: null }] });

describe('planTooltipCopy', () => {
  it('copies tooltips and turns the note into the tooltip of 1 ședință grup', () => {
    const plan = planTooltipCopy({ tiers, lists: [standard(), gold()] });
    expect(plan.updates).toHaveLength(1);
    const [u] = plan.updates;
    expect(u).toMatchObject({ documentId: 'list-standard', filled: ['Abonament 6 ședințe grup', '1 ședință grup'] });
    expect(u.items).toEqual([
      { ...standard().items[0], tooltip: TOOLTIP_6 },
      standard().items[1],
      { ...standard().items[2], tooltip: 'Disponibil doar pentru prima ședință' },
    ]);
    expect(plan).toMatchObject({ unmatched: [], droppedNotes: [], conflicts: [] });
  });

  it('matches names regardless of case, spaces and diacritics', () => {
    const plan = planTooltipCopy({ tiers: { memberTiers: [{ label: ' abonament 6 sedinte GRUP', tooltip: 'x' }] }, lists: [standard()] });
    expect(plan.updates[0].filled).toEqual(['Abonament 6 ședințe grup']);
  });

  it('never overwrites a tooltip and changes nothing on a second run', () => {
    const first = planTooltipCopy({ tiers, lists: [standard()] });
    const again = planTooltipCopy({ tiers, lists: [{ ...standard(), items: first.updates[0].items }] });
    expect(again.updates).toEqual([]);
  });

  it('reports what it cannot place', () => {
    const plan = planTooltipCopy({
      tiers: {
        memberTiers: [
          { label: 'Lecție individuală', tooltip: 'Doar cu programare' },
          { label: 'Abonament 6 ședințe grup', tooltip: 'A', note: 'Notă veche' },
        ],
        nonMemberTiers: [{ label: 'Abonament 6 ședințe grup', tooltip: 'B' }],
      },
      lists: [standard()],
    });
    expect(plan.unmatched).toEqual(['Lecție individuală']);
    expect(plan.droppedNotes).toEqual(['Abonament 6 ședințe grup: Notă veche']);
    expect(plan.conflicts).toEqual(['Abonament 6 ședințe grup']);
    expect(plan.updates[0].items[0].tooltip).toBe('A');
  });
});

describe('planPriceNotesCopy', () => {
  const footerNotes = ['Nota 1', ' Nota 2 '];
  const school = { documentId: 'sec-school', name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', priceNotes: null };
  const club = { documentId: 'sec-club', name: 'Club', kind: 'club', priceNotes: null };

  it('copies the footer notes onto the school section', () =>
    expect(planPriceNotesCopy({ footerNotes, sections: [school, club] })).toEqual({
      update: { documentId: 'sec-school', priceNotes: ['Nota 1', 'Nota 2'] },
      report: [],
    }));

  it('does nothing when the notes are already there', () =>
    expect(planPriceNotesCopy({ footerNotes, sections: [{ ...school, priceNotes: ['Nota 1', 'Nota 2'] }] })).toEqual({ update: null, report: [] }));

  it('reports, without overwriting, notes an admin already changed', () => {
    const plan = planPriceNotesCopy({ footerNotes, sections: [{ ...school, priceNotes: ['Altă notă'] }] });
    expect(plan.update).toBeNull();
    expect(plan.report).toHaveLength(1);
  });

  it('reports when there is not exactly one school section', () => {
    expect(planPriceNotesCopy({ footerNotes, sections: [club] }).report).toHaveLength(1);
    expect(planPriceNotesCopy({ footerNotes, sections: [school, { ...school, documentId: 'sec-2' }] }).report).toHaveLength(1);
  });

  it('does nothing without old notes', () => expect(planPriceNotesCopy({ footerNotes: null, sections: [school] })).toEqual({ update: null, report: [] }));
});

describe('planSchoolPublicPage', () => {
  const school = { documentId: 'sec-school', name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', publicPage: false };
  const club = { documentId: 'sec-club', name: 'Club', kind: 'club', publicPage: false };

  it('switches on the public page of the school section, never of Club', () =>
    expect(planSchoolPublicPage([school, club])).toEqual({
      update: { documentId: 'sec-school', name: 'Școala de Patinaj - AFI Cotroceni' },
      report: [],
    }));

  it('does nothing once it is on (second run)', () =>
    expect(planSchoolPublicPage([{ ...school, publicPage: true }, club])).toEqual({ update: null, report: [] }));

  it('reports, without changing anything, when there is not exactly one school section', () => {
    expect(planSchoolPublicPage([club])).toEqual({ update: null, report: ['expected one school section, found 0; publicPage not set'] });
    expect(planSchoolPublicPage([school, { ...school, documentId: 'sec-2' }]).update).toBeNull();
  });
});

describe('planCustomQuestionRemoval', () => {
  const overlay = {
    q: { email: { label: 'E-mail' } },
    removed: { level: true },
    order: { date: ['email', 'c_ab12', 'parentName'], finalizare: ['source'] },
    custom: [{ key: 'c_ab12', type: 'text', step: 'date', label: 'Ce școală frecventează?', required: true }],
  };

  it('removes the custom questions and their places in the order, keeping everything else', () =>
    expect(planCustomQuestionRemoval(overlay)).toEqual({
      removed: ['Ce școală frecventează?'],
      overlay: {
        q: { email: { label: 'E-mail' } },
        removed: { level: true },
        order: { date: ['email', 'parentName'], finalizare: ['source'] },
      },
    }));

  it('does nothing when there are none (second run, empty or missing overlay)', () => {
    const first = planCustomQuestionRemoval(overlay);
    expect(planCustomQuestionRemoval(first.overlay)).toEqual({ removed: [], overlay: null });
    expect(planCustomQuestionRemoval({ custom: [] })).toEqual({ removed: [], overlay: null });
    expect(planCustomQuestionRemoval(null)).toEqual({ removed: [], overlay: null });
  });
});

describe('checkSeasonAgainstLegacy', () => {
  const season = { documentId: 's', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 250 };
  const settings = { currentSeason: '2026–2027', seasonStartDate: '2026-10-01', seasonEndDate: '2027-05-31' };

  it('is silent when the Sezon matches the old settings', () =>
    expect(checkSeasonAgainstLegacy({ season, settings, memberFeePrice: '250 RON' })).toEqual([]));

  it('reports every difference', () =>
    expect(
      checkSeasonAgainstLegacy({
        season,
        settings: { currentSeason: '2025-2026', seasonStartDate: '2025-10-04', seasonEndDate: '2026-05-30' },
        memberFeePrice: '300 RON',
      }),
    ).toEqual([
      'season: Sezon 2026-2027, settings 2025-2026',
      'start month: Sezon 2026-10, settings 2025-10',
      'end month: Sezon 2027-05, settings 2026-05',
      'membership fee: Sezon 250, pricing 300',
    ]));

  it('ignores old values that are missing', () => expect(checkSeasonAgainstLegacy({ season, settings: {}, memberFeePrice: undefined })).toEqual([]));

  it('says so when there is no current Sezon', () =>
    expect(checkSeasonAgainstLegacy({ season: null, settings, memberFeePrice: '250 RON' })).toEqual([
      'no current Sezon: registrations will be refused',
    ]));
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npm test -- src/club/__tests__/registration-copy.test.ts`
Expected: FAIL (module `../migrate/registration-copy` not found).

- [ ] **Step 3: Implement**

`src/club/migrate/registration-copy.ts`:

```ts
import type { CurrentSeason } from '../current-season';
import { asText, asTextList } from '../narrow';
import { normalizeSeasonLabel } from '../season';
import { nameKey, parsePrice } from './names';

export type LegacyTier = { label?: unknown; price?: unknown; tooltip?: unknown; note?: unknown };
export type LegacyTiers = { memberTiers?: LegacyTier[]; nonMemberTiers?: LegacyTier[]; memberFeePrice?: unknown };
export type ItemForCopy = { name: string; tooltip?: string | null } & Record<string, unknown>;
export type PriceListForCopy = { documentId: string; name: string; items: ItemForCopy[] };
export type TooltipUpdate = { documentId: string; name: string; items: ItemForCopy[]; filled: string[] };
export type TooltipPlan = { updates: TooltipUpdate[]; unmatched: string[]; droppedNotes: string[]; conflicts: string[] };
export type SectionForNotes = { documentId: string; name: string; kind?: unknown; priceNotes?: unknown };
export type LegacySeasonSettings = { currentSeason?: unknown; seasonStartDate?: unknown; seasonEndDate?: unknown };
export type SectionForPage = { documentId: string; name: string; kind?: unknown; publicPage?: unknown };

type TooltipSource = { text: string; label: string };
type Collected = { byKey: Map<string, TooltipSource>; droppedNotes: string[]; conflicts: string[] };

/** A tier's tooltip, or its note when it has none ("notes become tooltips"). */
function tierText(t: LegacyTier, droppedNotes: string[]): string {
  const tooltip = asText(t.tooltip);
  const note = asText(t.note);
  if (tooltip && note) droppedNotes.push(`${asText(t.label)}: ${note}`);
  return tooltip || note;
}

function collectTooltips(tiers: LegacyTiers): Collected {
  const out: Collected = { byKey: new Map(), droppedNotes: [], conflicts: [] };
  for (const t of [...(tiers.memberTiers ?? []), ...(tiers.nonMemberTiers ?? [])]) {
    const label = asText(t.label);
    const text = tierText(t, out.droppedNotes);
    if (!label || !text) continue;
    const prev = out.byKey.get(nameKey(label));
    if (prev && prev.text !== text) out.conflicts.push(label);
    if (!prev) out.byKey.set(nameKey(label), { text, label });
  }
  return out;
}

function fillList(list: PriceListForCopy, byKey: Map<string, TooltipSource>, used: Set<string>): TooltipUpdate | null {
  const filled: string[] = [];
  const items = list.items.map((item) => {
    const key = nameKey(item.name);
    const source = byKey.get(key);
    if (source) used.add(key);
    if (!source || asText(item.tooltip)) return item;
    filled.push(item.name);
    return { ...item, tooltip: source.text };
  });
  return filled.length ? { documentId: list.documentId, name: list.name, items, filled } : null;
}

export function planTooltipCopy(input: { tiers: LegacyTiers; lists: PriceListForCopy[] }): TooltipPlan {
  const { byKey, droppedNotes, conflicts } = collectTooltips(input.tiers);
  const used = new Set<string>();
  const updates = input.lists
    .map((list) => fillList(list, byKey, used))
    .filter((u): u is TooltipUpdate => u !== null);
  const unmatched = [...byKey.entries()].filter(([key]) => !used.has(key)).map(([, source]) => source.label);
  return { updates, unmatched, droppedNotes, conflicts };
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** pricing.footerNotes onto the school section's priceNotes, only when those are empty. */
export function planPriceNotesCopy(input: { footerNotes: unknown; sections: SectionForNotes[] }): {
  update: { documentId: string; priceNotes: string[] } | null;
  report: string[];
} {
  const notes = asTextList(input.footerNotes);
  if (notes.length === 0) return { update: null, report: [] };
  const schools = input.sections.filter((s) => s.kind === 'school');
  if (schools.length !== 1) return { update: null, report: [`expected one school section, found ${schools.length}; price notes not copied`] };
  const [school] = schools;
  const current = asTextList(school.priceNotes);
  if (current.length === 0) return { update: { documentId: school.documentId, priceNotes: notes }, report: [] };
  if (sameList(current, notes)) return { update: null, report: [] };
  return { update: null, report: [`${school.name}: price notes already set and different; not overwritten`] };
}

/** The school section becomes the registration target and appears in the public read (user ruling, 2026-10-19). */
export function planSchoolPublicPage(sections: SectionForPage[]): {
  update: { documentId: string; name: string } | null;
  report: string[];
} {
  const schools = sections.filter((s) => s.kind === 'school');
  if (schools.length !== 1) return { update: null, report: [`expected one school section, found ${schools.length}; publicPage not set`] };
  const [school] = schools;
  return school.publicPage === true ? { update: null, report: [] } : { update: { documentId: school.documentId, name: school.name }, report: [] };
}

type CustomLike = { key?: unknown; label?: unknown };

function customQuestions(overlay: unknown): CustomLike[] {
  const custom = overlay && typeof overlay === 'object' ? (overlay as { custom?: unknown }).custom : undefined;
  return Array.isArray(custom) ? custom : [];
}

function withoutKeys(order: unknown, keys: Set<string>): unknown {
  if (!order || typeof order !== 'object') return order;
  return Object.fromEntries(
    Object.entries(order).map(([step, list]) => [step, Array.isArray(list) ? list.filter((k) => !keys.has(k)) : list]),
  );
}

/** The `inscriere` overlay without its custom (CMS-added) questions (user decision, 2026-10-03). Null: nothing to do. */
export function planCustomQuestionRemoval(overlay: unknown): { removed: string[]; overlay: Record<string, unknown> | null } {
  const custom = customQuestions(overlay);
  if (custom.length === 0) return { removed: [], overlay: null };
  const keys = new Set(custom.map((c) => asText(c.key)));
  const next: Record<string, unknown> = { ...(overlay as Record<string, unknown>) };
  delete next.custom;
  if ('order' in next) next.order = withoutKeys(next.order, keys);
  return { removed: custom.map((c) => asText(c.label) || asText(c.key)), overlay: next };
}

function monthDiff(which: string, sezon: string, legacy: unknown): string[] {
  const old = asText(legacy).slice(0, 7);
  const now = sezon.slice(0, 7);
  return old && old !== now ? [`${which} month: Sezon ${now}, settings ${old}`] : [];
}

/** Season period and fee from the old settings compared with the current Sezon. Reported, never written. */
export function checkSeasonAgainstLegacy(input: {
  season: CurrentSeason | null;
  settings: LegacySeasonSettings;
  memberFeePrice: unknown;
}): string[] {
  const { season, settings } = input;
  if (!season) return ['no current Sezon: registrations will be refused'];
  const diffs: string[] = [];
  const label = normalizeSeasonLabel(asText(settings.currentSeason));
  if (label && label !== season.label) diffs.push(`season: Sezon ${season.label}, settings ${label}`);
  diffs.push(...monthDiff('start', season.startMonth, settings.seasonStartDate));
  diffs.push(...monthDiff('end', season.endMonth, settings.seasonEndDate));
  const fee = parsePrice(input.memberFeePrice);
  if (fee !== null && fee !== season.membershipFee) diffs.push(`membership fee: Sezon ${season.membershipFee ?? 'empty'}, pricing ${fee}`);
  return diffs;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/club/__tests__/registration-copy.test.ts`
Expected: PASS. Then `npm test` (all, including the phase 1 `plan.test.ts`) and `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/club/migrate/registration-copy.ts src/club/__tests__/registration-copy.test.ts
git commit -m "feat(club): planners for the registration data copy and cleanup"
```

---

### Task 9: Submit flow and controller wiring

**Files:**
- Create: `src/club/registration-submit.ts`
- Create: `src/api/registration-submission/submit-deps.ts`
- Modify: `src/api/registration-submission/controllers/registration-submission.ts` (`SETTINGS_UID`, `Status`, `MAX_TEXT`, `getActiveSeason`, `submitPublic`)
- Test: `src/club/__tests__/registration-submit.test.ts`

**Interfaces:**
- Consumes: Task 1 (schema, generated types), Task 2 (options), Task 4 (`CurrentSeason`, `findCurrentSeason`, `pickSchool`, `SchoolRow`), Task 5 (service `createNumbered`, `RegistrationData`, `NumberedRegistration`), Task 6 (`PublicSchool`, `SubscriptionChoice`, `resolveSubscriptionChoice`, `loadSchoolPrices`), Task 7 (`readRegistrationInput`, `presenceValues`, `selectValues`, `checkRegistrationRules`, `parseChildHeight`).
- Produces:
  - `type SubmitErrorCode = 'invalid' | 'closed' | 'unknown-school' | 'choose-school' | 'save-failed'`
  - `type SubmitResult = { ok: true; registrationNumber: string } | { ok: false; code: SubmitErrorCode; error: string }`
  - `SUBMIT_ERRORS: Record<SubmitErrorCode, string>`, `MISSING_FIELDS_ERROR`, `CHOICE_ERROR`
  - `type RegistrationCreateData` (fields in Step 3)
  - `interface SubmitDeps` (Step 3)
  - `submitRegistration(body: Record<string, unknown>, slug: string | null, deps: SubmitDeps): Promise<SubmitResult>`
  - `isRegistrationOpen(registration: unknown): boolean` (the global "Înscrieri deschise" switch; closed only when `open` is explicitly false, as the website reads it today)
  - `buildSubmitDeps(strapi: Core.Strapi): SubmitDeps` (`src/api/registration-submission/submit-deps.ts`)
  - HTTP: `POST /api/forms/inscriere?scoala=<slug>`; 200 `{ ok: true, registrationNumber }`; 400 `{ ok: false, code, error }`. The response no longer carries `documentId` (DECISIONS 2026-10-03: the internal id stays hidden; the frontend never read it).

Order of checks: honeypot, the global switch `site-settings.registration.open` (`closed`), current Sezon (`closed`), school (`unknown-school`, `closed`, `choose-school`), required answers (form-config `effectiveRequired`), form-config selects, e-mail and phone formats, rules (Task 7), subscription choice against the school's lists, then create with a number. As before, a failing form-config service never blocks a submission. The registration form has no custom questions (user decision 2026-10-03), so `validateExtra` is never called and `extra` is never stored, whatever the body sends. Server-set fields: `status: 'Nou'`, `submittedAt`, `season` (current Sezon label, keeps the Înscrieri filters working), `seasonRef`, `section`, `archived: false`, and the frozen `subscriptionChoice`.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/registration-submit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CurrentSeason } from '../current-season';
import type { PublicSchool } from '../public-info';
import { LAST_SEASON_OPTIONS, SOURCE_OPTIONS } from '../registration-form-options';
import {
  CHOICE_ERROR,
  MISSING_FIELDS_ERROR,
  SUBMIT_ERRORS,
  isRegistrationOpen,
  submitRegistration,
  type RegistrationCreateData,
  type SubmitDeps,
} from '../registration-submit';

const SEASON: CurrentSeason = { documentId: 'season-doc', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 250 };
const SCHOOL: PublicSchool = {
  name: 'Școala de Patinaj - AFI Cotroceni',
  slug: 'afi-cotroceni',
  priceNotes: [],
  priceLists: [
    {
      name: 'Standard',
      items: [
        { name: 'Abonament 8 ședințe grup', kind: 'subscription', sessions: 8, memberPrice: 590, nonMemberPrice: 790, tooltip: null },
        { name: '1 ședință grup', kind: 'session', sessions: null, memberPrice: null, nonMemberPrice: 150, tooltip: null },
      ],
    },
  ],
};
const BODY = {
  email: 'ana.pop@example.com',
  parentName: 'Ana Pop',
  relationship: 'parinte',
  phone: '0712345678',
  childName: 'Maria Pop',
  childBirthDate: '14.03.2016',
  childHeight: '132',
  shirtSize: 'S',
  lastSeason: LAST_SEASON_OPTIONS[0],
  priorExperience: 'Nu este cazul',
  expectations: 'Să învețe să patineze',
  membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 1, member: false },
  source: SOURCE_OPTIONS[0],
  gdprConsent: true,
  regulationsConsent: true,
};

function fake(over: Partial<SubmitDeps> = {}) {
  const created: { data: RegistrationCreateData; startYear: number }[] = [];
  const errors: string[] = [];
  const deps: SubmitDeps = {
    effectiveRequired: async () => ({}),
    validateBuiltinSelects: async () => null,
    validateFieldFormats: async () => null,
    registrationsEnabled: async () => true,
    findCurrentSeason: async () => SEASON,
    findSections: async () => [
      { documentId: 'sec-school', slug: 'afi-cotroceni', kind: 'school', publicPage: true },
      { documentId: 'sec-club', slug: 'club', kind: 'club', publicPage: false },
    ],
    findSchoolPrices: async () => SCHOOL,
    createNumbered: async (data, startYear) => {
      created.push({ data, startYear });
      return { registrationNumber: '2026-0008' };
    },
    logError: (message) => {
      errors.push(message);
    },
    now: () => new Date('2026-10-19T08:00:00.000Z'),
    ...over,
  };
  return { deps, created, errors };
}

describe('submitRegistration', () => {
  it('saves a numbered registration with server-set season, school and price', async () => {
    const { deps, created } = fake();
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: true, registrationNumber: '2026-0008' });
    expect(created).toEqual([
      {
        startYear: 2026,
        data: {
          email: 'ana.pop@example.com',
          phone: '0712345678',
          parentName: 'Ana Pop',
          relationship: 'parinte',
          childName: 'Maria Pop',
          childBirthDate: '14.03.2016',
          childHeight: 132,
          shirtSize: 'S',
          lastSeason: LAST_SEASON_OPTIONS[0],
          priorExperience: 'Nu este cazul',
          expectations: 'Să învețe să patineze',
          membershipAnswer: 'da',
          subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 590, member: true },
          source: SOURCE_OPTIONS[0],
          gdprConsent: true,
          regulationsConsent: true,
          status: 'Nou',
          submittedAt: '2026-10-19T08:00:00.000Z',
          season: '2026-2027',
          seasonRef: 'season-doc',
          section: 'sec-school',
          archived: false,
        },
      },
    ]);
  });

  it('rejects a filled honeypot without saving', async () => {
    const { deps, created } = fake();
    await expect(submitRegistration({ ...BODY, website: 'spam' }, null, deps)).resolves.toEqual({ ok: false, code: 'invalid', error: SUBMIT_ERRORS.invalid });
    expect(created).toEqual([]);
  });

  it('refuses while "Înscrieri deschise" is off, before reading anything else', async () => {
    let seasonRead = false;
    const { deps, created } = fake({
      registrationsEnabled: async () => false,
      findCurrentSeason: async () => {
        seasonRead = true;
        return SEASON;
      },
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: false, code: 'closed', error: SUBMIT_ERRORS.closed });
    expect(seasonRead).toBe(false);
    expect(created).toEqual([]);
  });

  it('refuses when no Sezon is current', async () => {
    let sectionsRead = false;
    const { deps, created } = fake({
      findCurrentSeason: async () => null,
      findSections: async () => {
        sectionsRead = true;
        return [];
      },
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: false, code: 'closed', error: SUBMIT_ERRORS.closed });
    expect(sectionsRead).toBe(false);
    expect(created).toEqual([]);
  });

  it('refuses an unknown ?scoala and the Club', async () => {
    const { deps, created } = fake();
    await expect(submitRegistration(BODY, 'nu-exista', deps)).resolves.toMatchObject({ ok: false, code: 'unknown-school' });
    await expect(submitRegistration(BODY, 'club', deps)).resolves.toMatchObject({ ok: false, code: 'unknown-school' });
    expect(created).toEqual([]);
  });

  it('asks to choose when two schools have a public page and none is named', async () => {
    const { deps } = fake({
      findSections: async () => [
        { documentId: 'a', slug: 'afi-cotroceni', kind: 'school', publicPage: true },
        { documentId: 'b', slug: 'baneasa', kind: 'school', publicPage: true },
      ],
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toMatchObject({ ok: false, code: 'choose-school' });
  });

  it('refuses missing required answers', async () => {
    const { deps } = fake();
    await expect(submitRegistration({ ...BODY, childHeight: '' }, null, deps)).resolves.toEqual({ ok: false, code: 'invalid', error: MISSING_FIELDS_ERROR });
  });

  it('passes form-config errors through', async () => {
    const { deps } = fake({ validateBuiltinSelects: async () => 'Valoare invalidă pentru câmpul "Sezonul trecut".' });
    await expect(submitRegistration(BODY, null, deps)).resolves.toMatchObject({ ok: false, error: 'Valoare invalidă pentru câmpul "Sezonul trecut".' });
  });

  it('never blocks on a broken form-config service', async () => {
    const broken = async (): Promise<never> => {
      throw new Error('config down');
    };
    const { deps, created } = fake({ effectiveRequired: broken, validateBuiltinSelects: broken });
    await expect(submitRegistration(BODY, null, deps)).resolves.toMatchObject({ ok: true });
    expect(created).toHaveLength(1);
  });

  it('refuses an item not offered to members, and prices it for a non-member', async () => {
    const single = { ...BODY, subscriptionChoice: { priceItemName: '1 ședință grup' } };
    const { deps, created } = fake();
    await expect(submitRegistration(single, null, deps)).resolves.toEqual({ ok: false, code: 'invalid', error: CHOICE_ERROR });
    await expect(submitRegistration({ ...single, membershipAnswer: 'nu' }, null, deps)).resolves.toMatchObject({ ok: true });
    expect(created[0].data.subscriptionChoice).toEqual({ priceItemName: '1 ședință grup', price: 150, member: false });
  });

  it('never validates or stores custom answers (the form has no custom questions)', async () => {
    const { deps, created } = fake();
    await expect(submitRegistration({ ...BODY, extra: { c_old1: 'Răspuns' } }, null, deps)).resolves.toMatchObject({ ok: true });
    expect('extra' in created[0].data).toBe(false);
  });

  it('keeps the follow-up texts only with Alta / Altele', async () => {
    const { deps, created } = fake();
    await submitRegistration({ ...BODY, relationshipOther: 'Bunic', sourceOther: 'Ziar' }, null, deps);
    expect(created[0].data.relationshipOther).toBeUndefined();
    expect(created[0].data.sourceOther).toBeUndefined();
  });

  it('reports a failed save without details and logs it', async () => {
    const { deps, errors } = fake({
      createNumbered: async () => {
        throw new Error('No free registration number after 6 attempts');
      },
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: false, code: 'save-failed', error: SUBMIT_ERRORS['save-failed'] });
    expect(errors[0]).toContain('No free registration number');
  });
});

describe('isRegistrationOpen', () => {
  it('is closed only when the switch is explicitly off', () => {
    expect(isRegistrationOpen({ open: false, currentSeason: '2026-2027' })).toBe(false);
    expect(isRegistrationOpen({ open: true })).toBe(true);
    expect(isRegistrationOpen({})).toBe(true);
    expect(isRegistrationOpen(null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npm test -- src/club/__tests__/registration-submit.test.ts`
Expected: FAIL (module `../registration-submit` not found).

- [ ] **Step 3: Implement the submit flow**

`src/club/registration-submit.ts`:

```ts
import type { CurrentSeason } from './current-season';
import { resolveSubscriptionChoice, type PublicSchool, type SubscriptionChoice } from './public-info';
import {
  MEMBERSHIP_NO,
  MEMBERSHIP_YES,
  RELATIONSHIP_OTHER,
  SOURCE_OTHER,
  isRelationship,
  type MembershipAnswer,
  type Relationship,
} from './registration-form-options';
import {
  checkRegistrationRules,
  parseChildHeight,
  presenceValues,
  readRegistrationInput,
  selectValues,
  type RegistrationInput,
} from './registration-input';
import { pickSchool, type SchoolChoiceCode, type SchoolRow } from './school-choice';
import { seasonStartYear } from './season';

export type SubmitErrorCode = 'invalid' | SchoolChoiceCode | 'save-failed';
export type SubmitResult = { ok: true; registrationNumber: string } | { ok: false; code: SubmitErrorCode; error: string };

export const SUBMIT_ERRORS: Record<SubmitErrorCode, string> = {
  invalid: 'Cerere invalidă.',
  closed: 'Înscrierile sunt închise.',
  'unknown-school': 'Școala nu a fost găsită.',
  'choose-school': 'Alegeți școala.',
  'save-failed': 'Nu am putut salva înscrierea.',
};
export const MISSING_FIELDS_ERROR = 'Câmpuri obligatorii lipsă.';
export const CHOICE_ERROR = 'Abonamentul ales nu este disponibil.';

/** Everything stored for a new registration except its number. A type alias: Strapi JSON needs one. */
export type RegistrationCreateData = {
  email: string;
  phone: string;
  parentName: string;
  relationship?: Relationship;
  relationshipOther?: string;
  childName: string;
  childBirthDate: string;
  childHeight?: number;
  shirtSize: string;
  lastSeason?: string;
  priorExperience?: string;
  expectations?: string;
  membershipAnswer: MembershipAnswer;
  subscriptionChoice: SubscriptionChoice;
  source?: string;
  sourceOther?: string;
  gdprConsent: boolean;
  regulationsConsent: boolean;
  status: 'Nou';
  submittedAt: string;
  season: string;
  seasonRef: string;
  section: string;
  archived: false;
};

export interface SubmitDeps {
  effectiveRequired(): Promise<Record<string, boolean>>;
  validateBuiltinSelects(values: Record<string, string>): Promise<string | null>;
  validateFieldFormats(values: Record<string, string>): Promise<string | null>;
  registrationsEnabled(): Promise<boolean>;
  findCurrentSeason(): Promise<CurrentSeason | null>;
  findSections(): Promise<SchoolRow[]>;
  findSchoolPrices(sectionDocumentId: string): Promise<PublicSchool | null>;
  createNumbered(data: RegistrationCreateData, startYear: number): Promise<{ registrationNumber: string }>;
  logError(message: string): void;
  now(): Date;
}

type Failure = { ok: false; result: SubmitResult };
type Step<T> = { ok: true; value: T } | Failure;
type SubmitContext = { season: CurrentSeason; school: { documentId: string; slug: string } };

/** The global "Înscrieri deschise" switch (site-settings.registration.open). Closed only when explicitly off, as the website reads it. */
export function isRegistrationOpen(registration: unknown): boolean {
  return !(registration && typeof registration === 'object' && (registration as { open?: unknown }).open === false);
}

function stop(code: SubmitErrorCode, error: string = SUBMIT_ERRORS[code]): Failure {
  return { ok: false, result: { ok: false, code, error } };
}

async function resolveContext(slug: string | null, deps: SubmitDeps): Promise<Step<SubmitContext>> {
  if (!(await deps.registrationsEnabled())) return stop('closed');
  const season = await deps.findCurrentSeason();
  if (!season) return stop('closed');
  const school = pickSchool(await deps.findSections(), slug);
  if (school.ok === false) return stop(school.code);
  return { ok: true, value: { season, school: { documentId: school.documentId, slug: school.slug } } };
}

async function loadRequired(deps: SubmitDeps): Promise<(key: string) => boolean> {
  let map: Record<string, boolean> = {};
  try {
    map = await deps.effectiveRequired();
  } catch {
    map = {};
  }
  return (key) => (key in map ? map[key] : true);
}

async function configCheck(input: RegistrationInput, deps: SubmitDeps): Promise<string | null> {
  try {
    return (
      (await deps.validateBuiltinSelects(selectValues(input))) ??
      (await deps.validateFieldFormats({ email: input.email, phone: input.phone }))
    );
  } catch {
    return null; // config service unavailable: never block (unchanged behaviour)
  }
}

/** The first error in the answers, or null. No custom answers: the registration form has none. */
async function validateInput(input: RegistrationInput, deps: SubmitDeps): Promise<string | null> {
  const isRequired = await loadRequired(deps);
  const missing = Object.entries(presenceValues(input)).some(([key, value]) => isRequired(key) && !value);
  if (missing) return MISSING_FIELDS_ERROR;
  return (await configCheck(input, deps)) ?? checkRegistrationRules(input, isRequired);
}

async function chooseSubscription(input: RegistrationInput, ctx: SubmitContext, deps: SubmitDeps): Promise<Step<SubscriptionChoice>> {
  const school = await deps.findSchoolPrices(ctx.school.documentId);
  const member = input.membershipAnswer === MEMBERSHIP_YES;
  const choice = school ? resolveSubscriptionChoice(school, input.priceItemName, member) : null;
  return choice ? { ok: true, value: choice } : stop('invalid', CHOICE_ERROR);
}

function personFields(i: RegistrationInput) {
  return {
    email: i.email,
    phone: i.phone,
    parentName: i.parentName,
    relationship: isRelationship(i.relationship) ? i.relationship : undefined,
    relationshipOther: i.relationship === RELATIONSHIP_OTHER ? i.relationshipOther : undefined,
  };
}

function childFields(i: RegistrationInput) {
  return {
    childName: i.childName,
    childBirthDate: i.childBirthDate,
    childHeight: parseChildHeight(i.childHeight) ?? undefined,
    shirtSize: i.shirtSize,
    lastSeason: i.lastSeason || undefined,
    priorExperience: i.priorExperience || undefined,
    expectations: i.expectations || undefined,
  };
}

function answerFields(i: RegistrationInput, choice: SubscriptionChoice) {
  return {
    membershipAnswer: i.membershipAnswer === MEMBERSHIP_YES ? MEMBERSHIP_YES : MEMBERSHIP_NO,
    subscriptionChoice: choice,
    source: i.source || undefined,
    sourceOther: i.source === SOURCE_OTHER ? i.sourceOther : undefined,
    gdprConsent: i.gdprConsent,
    regulationsConsent: i.regulationsConsent,
  };
}

function buildCreateData(i: RegistrationInput, ctx: SubmitContext, choice: SubscriptionChoice, now: Date): RegistrationCreateData {
  return {
    ...personFields(i),
    ...childFields(i),
    ...answerFields(i, choice),
    status: 'Nou',
    submittedAt: now.toISOString(),
    season: ctx.season.label,
    seasonRef: ctx.season.documentId,
    section: ctx.school.documentId,
    archived: false,
  };
}

async function save(data: RegistrationCreateData, startYear: number, deps: SubmitDeps): Promise<SubmitResult> {
  try {
    const { registrationNumber } = await deps.createNumbered(data, startYear);
    return { ok: true, registrationNumber };
  } catch (err) {
    deps.logError(`[inscriere] create failed: ${err instanceof Error ? err.message : String(err)}`);
    return stop('save-failed').result;
  }
}

/** POST /api/forms/inscriere: check, then store a numbered registration for the current Sezon. A body `extra` is ignored. */
export async function submitRegistration(body: Record<string, unknown>, slug: string | null, deps: SubmitDeps): Promise<SubmitResult> {
  const input = readRegistrationInput(body);
  if (input.website) return stop('invalid').result; // honeypot: a filled value is a bot
  const ctx = await resolveContext(slug, deps);
  if (ctx.ok === false) return ctx.result;
  const error = await validateInput(input, deps);
  if (error) return stop('invalid', error).result;
  const choice = await chooseSubscription(input, ctx.value, deps);
  if (choice.ok === false) return choice.result;
  const data = buildCreateData(input, ctx.value, choice.value, deps.now());
  return save(data, seasonStartYear(ctx.value.season.label), deps);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/club/__tests__/registration-submit.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the dependencies**

`src/api/registration-submission/submit-deps.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { findCurrentSeason } from '../../club/current-season';
import { loadSchoolPrices } from '../../club/public-info-loader';
import { isRegistrationOpen, type SubmitDeps } from '../../club/registration-submit';
import type { NumberedRegistration, RegistrationData } from './services/registration-submission';

const FORM = 'inscriere';
const FORM_CONFIG_UID = 'api::form-config.form-config' as const;
const UID = 'api::registration-submission.registration-submission' as const;

type NumberedService = { createNumbered(data: RegistrationData, startYear: number): Promise<NumberedRegistration> };

/** The real Strapi side of submitRegistration. `RegistrationCreateData` is type-checked against the schema here. */
export function buildSubmitDeps(strapi: Core.Strapi): SubmitDeps {
  const config = () => strapi.service(FORM_CONFIG_UID);
  const registrations = () => strapi.service(UID) as NumberedService;
  return {
    effectiveRequired: () => config().effectiveRequired(FORM),
    validateBuiltinSelects: (values) => config().validateBuiltinSelects(FORM, values),
    validateFieldFormats: (values) => config().validateFieldFormats(FORM, values),
    registrationsEnabled: async () =>
      isRegistrationOpen((await strapi.documents('api::site-settings.site-settings').findFirst({}))?.registration),
    findCurrentSeason: () => findCurrentSeason(strapi),
    findSections: () => strapi.documents('api::section.section').findMany({ limit: 100 }),
    findSchoolPrices: (documentId) => loadSchoolPrices(strapi, documentId),
    createNumbered: (data, startYear) => registrations().createNumbered(data, startYear),
    logError: (message) => strapi.log.error(message),
    now: () => new Date(),
  };
}
```

- [ ] **Step 6: Rewire the controller**

In `src/api/registration-submission/controllers/registration-submission.ts`:

1. Under the existing imports add:

```ts
import { findCurrentSeason } from '../../../club/current-season';
import { submitRegistration } from '../../../club/registration-submit';
import { buildSubmitDeps } from '../submit-deps';
```

2. Delete `const SETTINGS_UID = 'api::site-settings.site-settings' as const;`, `type Status = (typeof STATUSES)[number];` and `const MAX_TEXT = 5000;`; none is used after step 4.

3. Replace `getActiveSeason` (its doc comment and the function) with:

```ts
/** The current Sezon's label. The old `site-settings.registration.currentSeason` text is no longer read. */
async function getActiveSeason(): Promise<string | null> {
  try {
    return (await findCurrentSeason(strapi))?.label ?? null;
  } catch {
    return null;
  }
}
```

4. Replace the whole `submitPublic` method and its doc comment (from `  /**` above `async submitPublic(ctx) {` down to the method's closing `},`) with:

```ts
  /**
   * POST /api/forms/inscriere?scoala=<slug>  (public, auth:false)
   * Honeypot, "Înscrieri deschise", current Sezon, school, form-config checks and the price choice, then a
   * numbered registration (src/club/registration-submit.ts). Status, dates, season,
   * school and price are set by the server; client values for them are ignored.
   * Returns 200 {ok:true, registrationNumber} or 400 {ok:false, code, error}.
   */
  async submitPublic(ctx) {
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const slug = typeof ctx.query.scoala === 'string' ? ctx.query.scoala : null;
    const result = await submitRegistration(body, slug, buildSubmitDeps(strapi));
    ctx.status = result.ok ? 200 : 400;
    ctx.body = result;
  },
```

`trimOrEmpty`, `asBool`, `STATUSES`, `FORM_CONFIG_UID` stay: the admin methods use them.

- [ ] **Step 7: Type-check and run everything**

Run: `npx tsc --noEmit`
Expected: zero errors. A mismatch between `RegistrationCreateData` and the regenerated schema types shows up here in `submit-deps.ts` (`createNumbered` argument); fix the alias, never the cast.
Run: `npm test`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/club/registration-submit.ts src/club/__tests__/registration-submit.test.ts \
  src/api/registration-submission/submit-deps.ts src/api/registration-submission/controllers/registration-submission.ts
git commit -m "feat(inscrieri): number, season and school on public submit; read the season from Sezon"
```

---

### Task 10: One-time copy script

**Files:**
- Create: `scripts/migrate-registration-data.js`
- Modify: `package.json` (`scripts`: add `migrate:registration` after `migrate:club`)

**Interfaces:**
- Consumes (compiled, `dist/src/club/...` after `npm run build`): `planTooltipCopy`, `planPriceNotesCopy`, `planSchoolPublicPage`, `planCustomQuestionRemoval`, `checkSeasonAgainstLegacy` (`migrate/registration-copy`), `duplicateItemNames` (`price-item`), `findCurrentSeason` (`current-season`), `recordHistory` (`history`).
- Produces: `npm run migrate:registration` (dry run), `npm run migrate:registration -- --apply`.
- Run it with the same environment as the Strapi instance it targets (Task 11 shows the throwaway one). A production run is a separate, user-approved step after a backup, as in phase 1.

The script never deletes data and never overwrites a value an admin has set, with one ruled exception: it deletes the custom questions of the `inscriere` form config. Registrations, including their stored `extra` answers, are never touched. It also reports price item names used twice in one school (plan 2B blocks saving those).

- [ ] **Step 1: Write the script**

`scripts/migrate-registration-data.js`:

```js
'use strict';
/**
 * Phase 2 one-time copy: tooltips and footer notes from the old Cursuri / Prețuri
 * single type onto the new price lists and the school section; the school section's
 * public page switched on; the custom questions of the inscriere form removed; reports
 * of duplicate price item names and of the current Sezon against the old season settings.
 * Dry run by default; pass --apply to write. Idempotent: it only fills empty values.
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');
const ACTOR = 'migrare';

function buildLog() {
  return (...a) => console.log(APPLY ? '[apply]' : '[dry-run]', ...a);
}

function buildUpdate(app, recordHistory) {
  return async (uid, subjectType, documentId, data, changes) => {
    if (!APPLY) return;
    await app.documents(uid).update({ documentId, data });
    await recordHistory(app, { subjectType, subjectId: documentId, action: 'updated', actor: ACTOR, changes });
  };
}

async function copyTooltips(ctx) {
  const { lists, pricing, planTooltipCopy, update, log } = ctx;
  const plan = planTooltipCopy({ tiers: pricing.tiers ?? {}, lists });
  for (const u of plan.updates) {
    log('price list', u.name, 'tooltips for:', u.filled.join(', '));
    await update('api::price-list.price-list', 'price-list', u.documentId, { items: u.items }, { tooltips: u.filled });
  }
  if (plan.unmatched.length) log('tooltips with no matching price item:', plan.unmatched.join(', '));
  if (plan.droppedNotes.length) log('notes dropped (the tier already had a tooltip):', plan.droppedNotes.join(' | '));
  if (plan.conflicts.length) log('different tooltips for the same name (first kept):', plan.conflicts.join(', '));
}

async function copyPriceNotes(ctx) {
  const { sections, pricing, planPriceNotesCopy, update, log } = ctx;
  const plan = planPriceNotesCopy({ footerNotes: pricing.footerNotes, sections });
  if (plan.update) {
    const { documentId, priceNotes } = plan.update;
    log('section price notes:', priceNotes.length, 'paragraphs');
    await update('api::section.section', 'section', documentId, { priceNotes }, { priceNotes });
  }
  plan.report.forEach((line) => log(line));
}

async function setSchoolPublicPage(ctx) {
  const { sections, planSchoolPublicPage, update, log } = ctx;
  const plan = planSchoolPublicPage(sections);
  if (plan.update) {
    log(`section ${plan.update.name}: publicPage on`);
    await update('api::section.section', 'section', plan.update.documentId, { publicPage: true }, { publicPage: true });
  }
  plan.report.forEach((line) => log(line));
}

async function removeCustomQuestions(ctx) {
  const { formConfig, planCustomQuestionRemoval, update, log } = ctx;
  if (!formConfig) return;
  const plan = planCustomQuestionRemoval(formConfig.overlay);
  if (!plan.overlay) return;
  log('form inscriere: remove custom questions:', plan.removed.join(', '));
  const changes = { removedCustomQuestions: plan.removed };
  await update('api::form-config.form-config', 'form-config', formConfig.documentId, { overlay: plan.overlay }, changes);
}

function reportDuplicateNames(ctx) {
  const bySection = new Map();
  for (const list of ctx.lists) {
    const name = list.section?.name ?? '(no section)';
    bySection.set(name, [...(bySection.get(name) ?? []), list]);
  }
  for (const [name, lists] of bySection) {
    const dupes = ctx.duplicateItemNames(lists);
    if (dupes.length) ctx.log(`section ${name}: price item names used twice:`, dupes.join(', '));
  }
}

function reportSeason(ctx) {
  const { season, settings, pricing, checkSeasonAgainstLegacy, log } = ctx;
  const diffs = checkSeasonAgainstLegacy({ season, settings, memberFeePrice: pricing.tiers?.memberFeePrice });
  diffs.forEach((d) => log('season check (not changed):', d));
  if (!diffs.length) log('season check: the current Sezon matches the old settings');
}

function loadLib(app) {
  const lib = (p) => require(`../dist/src/club/${p}`);
  const copy = lib('migrate/registration-copy');
  const { duplicateItemNames } = lib('price-item');
  const { findCurrentSeason } = lib('current-season');
  const { recordHistory } = lib('history');
  return {
    log: buildLog(),
    update: buildUpdate(app, recordHistory),
    planTooltipCopy: copy.planTooltipCopy,
    planPriceNotesCopy: copy.planPriceNotesCopy,
    planSchoolPublicPage: copy.planSchoolPublicPage,
    planCustomQuestionRemoval: copy.planCustomQuestionRemoval,
    checkSeasonAgainstLegacy: copy.checkSeasonAgainstLegacy,
    duplicateItemNames,
    findCurrentSeason,
  };
}

async function loadContext(app) {
  const lib = loadLib(app);
  const docs = (uid) => app.documents(uid);
  const pricing = (await docs('api::pricing.pricing').findFirst({})) ?? {};
  const settings = (await docs('api::site-settings.site-settings').findFirst({}))?.registration ?? {};
  const lists = await docs('api::price-list.price-list').findMany({
    populate: { items: true, section: { fields: ['name'] } },
    limit: 200,
  });
  const sections = await docs('api::section.section').findMany({ limit: 100 });
  const formConfig = await docs('api::form-config.form-config').findFirst({ filters: { type: 'inscriere' } });
  const season = await lib.findCurrentSeason(app);
  return { ...lib, pricing, settings, lists, sections, formConfig, season };
}

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';

  try {
    const ctx = await loadContext(app);
    await copyTooltips(ctx);
    await copyPriceNotes(ctx);
    await setSchoolPublicPage(ctx);
    await removeCustomQuestions(ctx);
    reportDuplicateNames(ctx);
    reportSeason(ctx);
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

In `package.json` `"scripts"`, after `"migrate:club": "node scripts/migrate-club-foundation.js",` add:

```json
    "migrate:registration": "node scripts/migrate-registration-data.js",
```

- [ ] **Step 3: Check syntax and the compiled planners**

Run: `node --check scripts/migrate-registration-data.js`
Expected: no output.
Run: `npm test` and `npx tsc --noEmit`: all PASS, zero errors. The dry run and apply run against real data in Task 11 (never against production here).

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-registration-data.js package.json
git commit -m "feat(club): one-time registration data copy and cleanup (dry run by default)"
```

---

### Task 11: Boot check on a throwaway Postgres

**Files:** none created in the repo. Temporary files live in `${TMPDIR:-/tmp}/es2a` and are removed at the end.

**Interfaces:**
- Consumes: everything above. Proves: the unique index exists; the public read shape and its absence of private fields; refusal without a current Sezon and with "Înscrieri deschise" off; unknown and Club slugs; the custom question removal leaving old answers intact; the copy script (dry run, apply, apply again); five simultaneous submits get five different numbers continuing after a number held in another season.

Notes: the Google Sheets lifecycle is inert here because the throwaway database has no connected sheet, so nothing reaches a real Sheet. If port 55432 is taken, pick another and change it in both places. When an agent runs this, start Strapi as a background job and poll `/_health`.

- [ ] **Step 1: Start Postgres and write the throwaway environment**

```bash
cd /Users/codrin/Documents/Programming/edusport_backend
T="${TMPDIR:-/tmp}/es2a"; mkdir -p "$T"
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
docker run -d --name es2a-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi \
  -p 127.0.0.1:55432:5432 postgres:16
until docker exec es2a-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
```

Expected: the build finishes and `ls dist/src/club/migrate/registration-copy.js dist/src/club/current-season.js` lists both files.

- [ ] **Step 2: First boot on the empty database**

```bash
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1338/_health | grep -q 204; do sleep 2; done
docker exec es2a-pg psql -U strapi -d strapi -c '\d registration_submissions' | grep registration_number
```

Expected: `"registration_submissions_registration_number_uq" UNIQUE CONSTRAINT, btree (registration_number)`.

```bash
curl -s -D "$T/headers" http://127.0.0.1:1338/api/club/public; echo
grep -i cache-control "$T/headers"
cat > "$T/body.json" <<'EOF'
{"email":"ana.pop@example.com","parentName":"Ana Pop","relationship":"parinte","phone":"0712345678",
 "childName":"Maria Pop","childBirthDate":"14.03.2016","childHeight":"132","shirtSize":"S",
 "lastSeason":"Nu a participat","priorExperience":"Nu este cazul","expectations":"Să învețe să patineze",
 "membershipAnswer":"da","subscriptionChoice":{"priceItemName":"Abonament 8 ședințe grup","price":1},
 "source":"Facebook","gdprConsent":true,"regulationsConsent":true}
EOF
curl -s -X POST http://127.0.0.1:1338/api/forms/inscriere -H 'Content-Type: application/json' --data-binary @"$T/body.json"; echo
docker exec es2a-pg psql -U strapi -d strapi -tAc 'select count(*) from registration_submissions'
kill "$(cat "$T/pid")"
```

Expected: `{"data":{"season":null,"membershipFee":null,"schools":[]}}`; `Cache-Control: public, max-age=60`; `{"ok":false,"code":"closed","error":"Înscrierile sunt închise."}`; count `0`.

- [ ] **Step 3: Load fixtures that look like production after phase 1**

```bash
cat > "$T/fixture.js" <<'EOF'
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  await d('api::site-settings.site-settings').create({ data: { registration: { open: true, currentSeason: '2026-2027', seasonStartDate: '2026-10-01', seasonEndDate: '2027-05-31' } } });
  await d('api::season.season').create({ data: { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 250, isCurrent: true } });
  await d('api::season.season').create({ data: { label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31', isCurrent: false } });
  const school = await d('api::section.section').create({ data: { name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', slug: 'afi-cotroceni', registrationsOpen: true, publicPage: false } });
  await d('api::section.section').create({ data: { name: 'Club', kind: 'club', slug: 'club', registrationsOpen: false, publicPage: false } });
  await d('api::price-list.price-list').create({ data: { name: 'Standard', section: school.documentId, items: [
    { name: 'Abonament 6 ședințe grup', kind: 'subscription', sessions: 6, memberPrice: 520, nonMemberPrice: 720 },
    { name: 'Abonament 8 ședințe grup', kind: 'subscription', sessions: 8, memberPrice: 590, nonMemberPrice: 790 },
    { name: '1 ședință grup', kind: 'session', nonMemberPrice: 150 },
  ] } });
  await d('api::price-list.price-list').create({ data: { name: 'Avansați Gold', section: school.documentId, items: [
    { name: 'Abonament Avansați Gold 8 ședințe', kind: 'subscription', sessions: 8, memberPrice: 600 },
  ] } });
  await d('api::registration-submission.registration-submission').create({ data: {
    email: 'vechi@example.com', phone: '0700000000', childName: 'Copil Vechi', childBirthDate: '01.01.2015',
    parentName: 'Părinte Vechi', shirtSize: 'M', status: 'Nou', season: '2025-2026',
    registrationNumber: '2026-0007', submittedAt: '2026-09-01T10:00:00.000Z', extra: { c_old1: 'Răspuns vechi' },
  } });
  await d('api::form-config.form-config').create({ data: { type: 'inscriere', overlay: {
    order: { date: ['email', 'c_old1'] },
    custom: [{ key: 'c_old1', type: 'text', step: 'date', label: 'Întrebare veche', required: true }],
  } } });
  console.log('fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
EOF
(set -a; . "$T/env"; set +a; node -e "$(cat "$T/fixture.js")")
(set -a; . "$T/env"; set +a; node scripts/seed-pricing.js)
```

Expected: `fixture ok`; the pricing seed prints `Done: 2 member tiers, 3 non-member tiers, 2 footer notes`. The fixture prices are test values (Gold's real price is not known yet). The old registration holds `2026-0007` but sits in season 2025-2026, to prove numbering counts every season; it also holds an answer to an old custom question. The school section starts with `publicPage` off, as phase 1 created it, and the `inscriere` form has one required custom question.

- [ ] **Step 4: Copy script: dry run, apply, apply again**

```bash
(set -a; . "$T/env"; set +a; npm run migrate:registration)
```

Expected lines (order as printed; Strapi's own startup log lines appear above them):

```
[dry-run] price list Standard tooltips for: Abonament 6 ședințe grup, 1 ședință grup
[dry-run] section price notes: 2 paragraphs
[dry-run] section Școala de Patinaj - AFI Cotroceni: publicPage on
[dry-run] form inscriere: remove custom questions: Întrebare veche
[dry-run] season check: the current Sezon matches the old settings
```

```bash
(set -a; . "$T/env"; set +a; npm run migrate:registration -- --apply)
(set -a; . "$T/env"; set +a; npm run migrate:registration -- --apply)
docker exec es2a-pg psql -U strapi -d strapi -tAc "select action, count(*) from history_entries where actor = 'migrare' group by action"
docker exec es2a-pg psql -U strapi -d strapi -tAc "select overlay from form_configs where type = 'inscriere'"
docker exec es2a-pg psql -U strapi -d strapi -tAc "select extra from registration_submissions where registration_number = '2026-0007'"
```

Expected: the first apply prints the same lines with `[apply]`; the second apply prints only the season check line; history shows `updated|4` (Standard tooltips, school notes, school public page, form config); the overlay is `{"order": {"date": ["email"]}}`; the old registration still has `{"c_old1": "Răspuns vechi"}`.

- [ ] **Step 5: Second boot: public read, slugs, prices, parallel numbering**

```bash
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1338/_health | grep -q 204; do sleep 2; done
curl -s http://127.0.0.1:1338/api/club/public > "$T/public.json"
node -e '
const { data } = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const s = data.schools;
const items = s[0].priceLists[0].items.map((i) => `${i.name}|${i.memberPrice}|${i.nonMemberPrice}|${i.tooltip ? "tooltip" : "-"}`);
console.log(data.season.label, data.membershipFee, s.map((x) => x.slug).join(","), s[0].priceLists.map((l) => l.name).join(","), s[0].priceNotes.length);
console.log(items.join(" ; "));
' "$T/public.json"
grep -c -E 'documentId|"id"|included|createdAt|publicPage' "$T/public.json"
```

Expected:

```
2026-2027 250 afi-cotroceni Standard,Avansați Gold 2
Abonament 6 ședințe grup|520|720|tooltip ; Abonament 8 ședințe grup|590|790|- ; 1 ședință grup|null|150|tooltip
0
```

```bash
post() { curl -s -X POST "http://127.0.0.1:1338/api/forms/inscriere$1" -H 'Content-Type: application/json' --data-binary @"$2"; echo; }
post '?scoala=nu-exista' "$T/body.json"
post '?scoala=club' "$T/body.json"
docker exec es2a-pg psql -U strapi -d strapi -c "update site_settings set registration = jsonb_set(registration, '{open}', 'false')"
post '' "$T/body.json"
docker exec es2a-pg psql -U strapi -d strapi -c "update site_settings set registration = jsonb_set(registration, '{open}', 'true')"
sed 's/Abonament 8 ședințe grup/1 ședință grup/' "$T/body.json" > "$T/single.json"
post '' "$T/single.json"
for i in 1 2 3 4 5; do post '' "$T/body.json" > "$T/r$i.json" & done; wait
cat "$T"/r?.json
cat "$T"/r?.json | grep -o '"registrationNumber":"[0-9-]*"' | sort | uniq -d
docker exec es2a-pg psql -U strapi -d strapi -tAc "select registration_number, season, membership_answer, subscription_choice from registration_submissions where season = '2026-2027' order by registration_number"
kill "$(cat "$T/pid")"
```

Expected:
- `{"ok":false,"code":"unknown-school","error":"Școala nu a fost găsită."}`
- `{"ok":false,"code":"unknown-school","error":"Școala nu a fost găsită."}` (Club is never a registration target)
- `UPDATE 1`, then `{"ok":false,"code":"closed","error":"Înscrierile sunt închise."}` ("Înscrieri deschise" off), then `UPDATE 1`
- `{"ok":false,"code":"invalid","error":"Abonamentul ales nu este disponibil."}` (a member cannot buy the non-member-only item)
- five `{"ok":true,"registrationNumber":"2026-00NN"}` with NN 08 to 12 in any order, no `documentId` in them; the `uniq -d` line prints nothing.
- five rows `2026-0008` to `2026-0012`, season `2026-2027`, `da`, `{"price": 590, "member": true, "priceItemName": "Abonament 8 ședințe grup"}` (the client's `"price":1` is ignored).

- [ ] **Step 6: Clean up and final checks**

```bash
docker rm -f es2a-pg
rm -rf "${TMPDIR:-/tmp}/es2a"
npm test
npx tsc --noEmit
```

Expected: container removed; all tests PASS; zero type errors. No commit in this task unless a check failed; a fix goes into the owning task's files with a `fix(...)` commit.

---

## Handled by later plans

- 2B (admin): Prețuri and Sezoane screens (tooltip, `priceNotes`, "Preț incomplet" via `isIncomplete`, "Lipsă" via `isOfferedTo`), removing the `pricing` editors and the season fields from Setări site, EditorCard band, history entries for every price, list, note and season change, Înscrieri panel showing the new fields, and how the form-config admin editor treats `subscriptionChoice` and the old custom questions.
- 2C (website and form): Cursuri, homepage, Regulament, Program and Înscrieri read `GET /api/club/public`; the 3-step form posts the new contract (`subscriptionChoice: { priceItemName }`, `?scoala=`), shows "closed" when `season` is null, the school choice per spec 3.3, the success screen with `registrationNumber`.
- PDFs and the 24-hour token, the Google Sheet columns and the e-mail jobs (spec 4.1-4.3) consume `RegistrationCreateData`, `CurrentSeason` and `PublicClubInfo`, and are planned separately.

## Notes for later plans

- The Sheet (2E) prints the stored membership answer `da` / `nu` as "Da" / "Nu".
- The branch must not deploy before plan 2C (the new form) is merged on it: 2A changes the public form contract.
- Before deploying, check production for duplicate registration numbers (`select registration_number, count(*) from registration_submissions where registration_number is not null group by 1 having count(*) > 1`): the new unique index cannot be created over duplicates and Strapi would not boot.
- Plan 2B uses `duplicateItemNames` to block saving a price item whose name is already used in the same school.
