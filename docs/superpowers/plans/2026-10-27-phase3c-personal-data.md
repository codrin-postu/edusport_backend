# Phase 3C: Personal Data (export, anonymize, yearly list) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any admin export one child's data as a ZIP ("Exportă datele"), let a Super Admin anonymize one child or a yearly list of inactive children ("Anonimizează") without changing group, season or A.C.S. counts, and show a dashboard notice while children are past the retention period, never acting by itself.

**Architecture:** Every rule is a pure module in `src/club/personal-data/` (copy, settings reader, inactivity rule, anonymize planner and history scrubbing, export summary model) with Vitest tests. The services (`anonymize-service.ts`, `export-service.ts`, `review.ts`) run on the existing `ClubStore` (`src/club/athletes/store.ts`), which gains the new reads and writes in both the Strapi store and the in-memory fake (parity test). The summary PDF reuses `src/club/documents/pdf/*` (fonts, wordmark, association footer) and the ZIP is built in memory with `fflate`. A new global policy `global::is-super-admin` guards the anonymize routes; the admin UI (record "..." menu, Sportivi list filter and bulk bar, dashboard notice, Setări site field) keeps its rules in pure modules (`src/club/sportivi/personal-data-view.ts`, `list-view.ts`) and is pinned by source-reading tests and a render pass on a throwaway Postgres.

**Tech Stack:** Strapi 5.52.1 (TypeScript, `strict: false` server, `strict: true` admin), Postgres 16, Vitest 3, pdfkit 0.20 (+ `unpdf` in tests), fflate 0.8.3, React 18 admin, Python Playwright, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-27-personal-data-design.md` (v1.1, approved 2026-10-27). Decisions: `../edusport_frontend/docs/portal/DECISIONS.md`, entries "phase 3C personal data", "phase 3C retention" and "phase 3 polish" (a later dated entry wins over the spec). Rules for executing agents: `.superpowers/phase3-shared/agent-rules.md`.

**Base:** `feat/athletes` at `6acaba0` or later. The polish round is merged there: `ClubStore.lockAthlete(id: string): Promise<void>`, `ClubStore.registrations({ athleteId?, matchAthleteId? })`, `src/club/athletes/locks.ts::lockAthletesWithRegistrations`, straight quotes in admin copy, history actions `mainGroupChanged` / `athleteUnlinked`.

**Parallel groups:** A: T1 | B: T2, T3, T4 | C: T5 | D: T6, T7, T8, T9 | E: T10 | F: T11 | G: T12, T13 | H: T14

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Foundation | nothing | schemas, statuses, history actions, copy module |
| B | 2 Settings and inactivity rule, 3 Anonymize planner, 4 Summary model and PDF | 1 | new files only, one per task |
| C | 5 Store methods | 3 (imports `RegistrationScrub`, `scrubbedJobStatus`) | store.ts, strapi-store.ts, fake-store.ts |
| D | 6 Anonymize service, 7 Anonymized athletes everywhere, 8 List and review server, 9 Export | 5 (and 2 for 8, 4 for 9) | 6: new files; 7: matches, confirm, record, merge, delete, profile, add-status, undo, documents/service; 8: list.ts, api-types.ts, review.ts; 9: export files, package.json |
| E | 10 Policy, routes, controllers, startup sweep | 6 to 9 | routes, controllers, policy, index.ts |
| F | 11 Admin record: menu, role gating, confirmation, read-only | 10 | sportivi record files, api.ts, routes.ts |
| G | 12 Admin list: filter, checkboxes, bulk bar; 13 Dashboard notice and Setări site | 11 | 12: list files, styles.ts; 13: DashboardPage, PersonalDataNotice, SetariSitePage |
| H | 14 Boot check and renders on a throwaway Postgres | everything | no repo files |

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

These are gaps or contradictions in the spec. Each is implemented in the one place named, so another answer is a small change. Log them in DECISIONS.md as "plan 3C, decided by Claude (low impact, 2026-10-27)".

1. **Default retention.** Spec 8 says "settings reader (default 3)", spec 2 and DECISIONS "phase 3C retention" say 5. The plan uses 5 (`settings.ts::DEFAULT_RETENTION_YEARS`).
2. **E-mail job schema.** Spec 2 says "no schema change on e-mail jobs", spec 4 allows "`cancelled` (new status value if missing)". The enum gains `cancelled` (Task 1). `recipient` and `subject` are `required` in the schema; they are written null through `strapi.db.query` (Task 5), which skips the document service's required check, so `required` stays as it is. `subject` is cleared too: it holds the child's name (`registrationSubject`).
3. **Registration fields that are `required`** (`email`, `phone`, `parentName`, `childBirthDate`, `shirtSize`) are nulled the same way, through `strapi.db.query(...).update` (Task 5). Database lifecycles still run, so the Înscrieri Google Sheet row is rewritten without the personal values.
4. **History keys scrubbed beyond the spec's list.** `athleteName` (confirmation line), `recipient` and `documents` (e-mail resent, document rebuilt: the address and file names carrying the child's name) are personal too, and the "Nu e același copil" line on the paired record that names the child is scrubbed (Task 3 `HISTORY_PERSONAL_KEYS`, Task 6 `scrubHistory`). An old -> new pair under a personal key keeps its shape with both sides null, so Istoric still shows that the field changed.
5. **Cancelled e-mail job** reads "Netrimis" in the panel and in the Sheet (existing word; Task 1).
6. **Anonymized record:** tabs Date and Istoric only (Profil public and Documente no longer exist), a neutral badge "Anonimizat", no "Date incomplete" badge, no "lipsește" markers, sub-line only the main group. The server refuses every write on it with 409 "Datele s-au schimbat. Reîncarcă pagina." (edit, status, profile, merge, delete, confirming onto it, undoing its confirmation), and a document build for its registrations is refused (404), so no PDF is ever re-created (Task 7).
7. **Inactivity rule details:** a season's year is the first four digits of its label; no current season means nobody is listed; "exactly N seasons" qualifies; an athlete with no activity qualifies when `createdAt` is at or before today minus N years (Task 2).
8. **Retention bounds:** a stored number outside 1 to 20 is clamped; a missing or non-integer value reads as 5 (Task 2).
9. **Copy the spec does not give** (all in `src/club/personal-data/copy.ts`): busy label "Se anonimizează..."; bulk title "Anonimizezi datele pentru <k sportivi>?"; toasts "1 sportiv anonimizat." / "<k> sportivi anonimizați." followed by "Sărite: <n>." and "Nereușite: <n>." when not zero; header checkbox "Selectează tot"; Setări site card "Date personale"; summary PDF: title "Date personale: <nume>", block "Înscrierea <nr>", rows "Sezon", "Școala", "Status", "Note", "Trimisă la", group value "<grupă>, principală", empty section "Nimic înregistrat.", last line "Generat la <data>, de <nume>."
10. **Bulk selection above 200** (phone cards can hold more): the client sends chunks of 200 and adds up the counts (Task 12); the route still refuses more than 200 per request.
11. **Single anonymize toast:** the bulk wording for one, "1 sportiv anonimizat." (Task 11).

## Needs decision (implemented as option A; nothing waits on it)

- **N1. Photos of the deleted public profile.** Spec 4 deletes the profile rows; the profile's `photo` and `gallery` files stay in the Media Library (their file names may carry the child's name). A: keep them (spec as written; this plan). B: also delete media files used only by that profile. Implemented nowhere (A writes nothing); B would be one more step in `anonymize-service.ts::anonymizeInTransaction`.
- **N2. Strapi content history.** If Task 14 finds a seeded value in `strapi_history_versions` (Strapi's own version history, if active for these types), stop and report NEEDS_DECISION with: A delete that athlete's and its registrations' version rows inside the anonymize transaction; B turn content history off for these types.

## Global Constraints

- Nothing is ever deleted or anonymized automatically (spec 1). The dashboard only shows a notice; every anonymization starts from a Super Admin's click.
- A dated entry in `edusport_frontend/docs/portal/DECISIONS.md` wins over the spec.
- **Lock order (binding, found by a real deadlock):** every write path locks registration rows first, then athlete rows, each set sorted by id. Anonymize (single and each athlete of the bulk) starts with `lockAthletesWithRegistrations(ctx.store, [id])` from `src/club/athletes/locks.ts`, which locks the athlete's linked registrations and every registration whose match points at it, then the athlete. Never call `lockAthlete` before those registration locks.
- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names (never in the integration worktrees p3be or p3fe); before every commit run `git rev-parse --show-toplevel` and `git branch --show-current` and compare with the dispatch.
- Checks after every task: the task's test file (`npx vitest run <file>`), the full suite (`npx vitest run`), `npx tsc --noEmit` (zero errors); after a task that touches `src/admin/`: also `npx tsc --noEmit -p src/admin/tsconfig.json` and `node scripts/admin-ui-check.mjs --strict` (exit 0).
- Code: TypeScript, no `any` (Strapi uids as `as const` strings or `UID.ContentType`), single quotes in `src/`, functions under 30 lines, cyclomatic complexity under 10, data passed to a Strapi json attribute is a `type` alias, no dead code, no comments that restate code.
- Admin routes: `{ auth: false, policies: ['global::is-admin'], middlewares: [] }`; anonymizing (single and bulk) and hiding the review: `{ auth: false, policies: ['global::is-super-admin'], middlewares: [] }`; fixed paths before `/club/athletes/:documentId`.
- After a schema change: `DATABASE_CLIENT=postgres npx strapi ts:generate-types` and commit `types/generated/` in the same task. A new attribute is saved only after Strapi restarts.
- `src/admin` is excluded from Vitest: rules live in `src/club/**` (pure: no DOM, React, Node or Strapi imports when the admin bundle imports them); admin wiring is pinned by source-reading tests.
- Copy: Romanian UI copy exactly as the spec gives it, every 3C string in `src/club/personal-data/copy.ts` (spec 7); ș and ț with the comma below; straight quotes "..." (polish 3); no em dash, no middle dot, no emoji; terse; failures show the shared "Acțiunea nu a reușit. Nimic nu a fost salvat." through the `guarded` wrappers (`src/club/admin-result.ts`).
- Design: admin tokens only (`var(--theme-*)`, `var(--ui-radius-*)`), no raw colours, no dashed or dotted lines, no pills or circles (square Checkbox), every screen at phone width (390 px), no backtick inside a CSS string.
- Tests and checks use synthetic data only. Never run anything against production, the user's local containers `strapi_app` / `strapi_db`, port 1337 or 5432, or the user's TEST environment (1340 / 3010, container `edusport-test-pg`). Task 14 uses container `es3c-pg` on 55438 and Strapi on 1347 only.
- Commits: Conventional Commits, exactly the message in the task, no `Co-Authored-By`, no AI attribution (after each commit run `git log -1 --format=%B` and amend if a trailer slipped in). Never push. Never commit `.env`.
- Progress board: one appended line per status change to `/Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`, e.g. `printf '%s | 3C T5 | implementer | tests green | 14/14\n' "$(date -u +%H:%M)" >> <that path>`.

## Review Focus

- Two admins anonymize the same child at the same moment, or a bulk list holds an already anonymized or deleted id: exactly one run writes, the other answers 409 or counts as "skipped"; "Date anonimizate" is written once. Pinned by Task 6 (`second run is 409`, bulk `skipped`).
- A registration PDF is asked for after the anonymization (a stale Înscrieri panel's "Vezi", the admin document route, "Retrimite e-mailul"): no PDF is rebuilt from the scrubbed row; the route answers 404 and the folder stays absent. Pinned by Task 7 (`buildRegistrationDocuments` refuses) and Task 14 (curl 404, folder absent).
- The PDF folder cannot be removed after the commit (permissions, a busy file): the anonymization still answers OK, the failure is logged, and the startup sweep removes the folder later. Pinned by Task 6 (`removeFiles` throws) and Task 14 (sweep after a restart).
- Old or odd season data: a season label without a leading year ("toamna"), no current season, an athlete created exactly N years ago, a retention of 1 or 25: the rule never throws and keeps the decided boundaries. Pinned by Task 2.
- An export of a child whose PDF file is missing, with an old registration that never had PDFs, and with a long Istoric: the ZIP is always built, "Document indisponibil" appears only where a PDF was expected, and the summary flows onto further pages with every line present. Pinned by Task 4 (multi-page) and Task 9.

---

## File Structure

```
src/club/
  ro-count.ts                          countWords (moved from sportivi/list-view.ts; list-view re-exports it) (T1)
  personal-data/
    copy.ts                            PERSONAL_DATA_COPY: every 3C string (T1)
    settings.ts                        DEFAULT_RETENTION_YEARS, RETENTION_BOUNDS, PersonalDataSettings, InactiveSummary, retentionYearsOf, readPersonalDataSettings, hiddenUntil, reviewNoticeShown (T2)
    inactivity.ts                      seasonStartYear, lastActiveYears, inactiveAthleteIds (T2)
    anonymize-plan.ts                  key lists, athleteScrub, registrationScrub, scrubChanges, scrubbedJobStatus, isAnonymized, readAnonymizeIds, MAX_BULK, BulkAnonymizeResult (T3)
    summary-model.ts                   SummaryInput, SummaryModel, buildSummaryModel (T4)
    summary-pdf.ts                     renderSummaryPdf (T4)
    anonymize-service.ts               AnonymizeContext, anonymizeAthlete, anonymizeAthletes (T6)
    sweep.ts                           sweepAnonymizedFolders (T6)
    review.ts                          inactiveSummary, hideInactiveReview (T8)
    export-zip.ts                      ZipEntry, exportFileName, zipExport, zipHeaders (T9)
    export-service.ts                  ExportContext, ExportDocument, ExportFile, exportAthleteData (T9)
    roles.ts                           SUPER_ADMIN_CODE, hasSuperAdminRole, superAdminFromMe (T10; pure, admin bundle too)
    super-admin.ts                     isSuperAdminRequest (T10; server only)
    http.ts                            anonymizeContext, exportContext, startPersonalDataSweep (T10)
    __tests__/                         one test file per task
  athletes/store.ts, strapi-store.ts, __tests__/fake-store.ts     new store methods, AthleteRow.createdAt / anonymizedAt (T5)
  athletes/matches.ts, confirm-read.ts, record.ts, add-status.ts, profile.ts, merge.ts, delete.ts, confirm-service.ts, undo-service.ts   skip / refuse anonymized (T7)
  documents/service.ts                 no build for an anonymized athlete's registration (T7)
  athletes/list.ts, api-types.ts       anonymized hidden by default, inactivity filter, retentionYears (T8)
  sportivi/record-view.ts              isReadOnlyRecord, read-only tabs and sub-line (T11)
  sportivi/personal-data-view.ts       record menu, dialog lines, export url (T11); selection and bulk helpers (T12)
  sportivi/list-view.ts                "Date personale" section, status "Anonimizat", inactive query (T12)
  sportivi/routes.ts                   inactiveListTo, wantsInactiveList (T11)
src/policies/is-super-admin.ts         global::is-super-admin (T10)
src/api/club/controllers/personal-data.ts, routes/05-athletes.ts    3C routes (T10)
src/index.ts                           startPersonalDataSweep at bootstrap (T10)
src/api/{athlete,site-settings,email-job}/content-types/*/schema.json   (T1)
src/email/job-state.ts, src/email/sheet-status.ts, src/club/registration-panel.ts   cancelled job (T1)
src/admin/dashboard/sportivi/          useSuperAdmin.ts, AnonymizeDialog.tsx, RecordMenu.tsx, AthleteRecordPage.tsx, DateTab.tsx, api.ts (T11);
                                       useSelection.ts, BulkAnonymizeBar.tsx, SportiviList.tsx, AthleteTable.tsx, AthleteCards.tsx, useAthleteList.ts, styles.ts (T12)
src/admin/dashboard/PersonalDataNotice.tsx, DashboardPage.tsx, src/admin/pages/SetariSitePage.tsx   (T13)
package.json, package-lock.json        fflate as a direct dependency (T9)
```

---

### Task 1: Foundation (schemas, statuses, history actions, cancelled e-mail job, copy)

**Files:**
- Modify: `src/api/athlete/content-types/athlete/schema.json`, `src/api/site-settings/content-types/site-settings/schema.json`, `src/api/email-job/content-types/email-job/schema.json`
- Regenerate: `types/generated/contentTypes.d.ts`
- Modify: `src/club/athlete-data.ts:7-8`, `src/club/history-text.ts` (`HISTORY_ACTIONS`, `STATUS_WORDS`, `RENDER`), `src/club/athletes/strapi-store.ts` (local `ATHLETE_STATUSES`)
- Modify: `src/email/job-state.ts:14`, `src/club/registration-panel.ts` (`EmailStatus.status`, `STATUSES`), `src/email/sheet-status.ts:10`
- Create: `src/club/ro-count.ts`; Modify: `src/club/sportivi/list-view.ts` (`needsDe`, `countWords`)
- Create: `src/club/personal-data/copy.ts`
- Test: `src/club/personal-data/__tests__/foundation.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - athlete: `status` enum `nou | activ | inactiv | anonimizat`, `anonymizedAt` datetime; site-settings: `personalData` json; email-job: `status` enum `queued | sent | failed | cancelled`.
  - `AthleteStatus = 'nou' | 'activ' | 'inactiv' | 'anonimizat'`, `ATHLETE_STATUSES` (same four), `STATUS_WORDS.anonimizat = 'Anonimizat'`.
  - `HISTORY_ACTIONS.dataExported = 'data-exported'` ("Date exportate"), `HISTORY_ACTIONS.dataAnonymized = 'data-anonymized'` ("Date anonimizate").
  - `EmailJobStatus = 'queued' | 'sent' | 'failed' | 'cancelled'`.
  - `countWords(n: number, one: string, many: string): string` in `src/club/ro-count.ts` (still re-exported by `list-view.ts`).
  - `PERSONAL_DATA_COPY` (`src/club/personal-data/copy.ts`), keys used by later tasks: `anonymizedName`, `anonymizedChild`, `menu.export`, `menu.anonymize`, `exported`, `dialog.{title, removed, kept, final, confirm, busy}`, `bulkTitle(k)`, `bulkButton(k)`, `done(k)`, `skipped(n)`, `failed(n)`, `selectAll`, `filterSection`, `inactiveOption(years)`, `notice(count, years)`, `noticeLink`, `noticeHide`, `settingsCard`, `settingsField`, `missingDocument`, `pdf.*`.

- [ ] **Step 1: Write the failing test**

`src/club/personal-data/__tests__/foundation.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emailStatusCell } from '../../../email/sheet-status';
import { ATHLETE_STATUSES } from '../../athlete-data';
import { HISTORY_ACTIONS, STATUS_WORDS, SUBJECT, historyTexts } from '../../history-text';
import { emailStatusText, readEmailStatus } from '../../registration-panel';
import { countWords } from '../../ro-count';
import { PERSONAL_DATA_COPY as C } from '../copy';

const API = join(__dirname, '..', '..', '..', 'api');
const schema = (name: string) => JSON.parse(readFileSync(join(API, name, 'content-types', name, 'schema.json'), 'utf8'));

describe('3C data (spec 2)', () => {
  it('athlete: status "anonimizat" and the time of the anonymization', () => {
    const a = schema('athlete').attributes;
    expect(a.status.enum).toEqual(['nou', 'activ', 'inactiv', 'anonimizat']);
    expect(a.anonymizedAt).toEqual({ type: 'datetime' });
    expect(ATHLETE_STATUSES).toEqual(['nou', 'activ', 'inactiv', 'anonimizat']);
    expect(STATUS_WORDS.anonimizat).toBe('Anonimizat');
  });

  it('site settings hold personalData; an e-mail job can be cancelled', () => {
    expect(schema('site-settings').attributes.personalData).toEqual({ type: 'json' });
    expect(schema('email-job').attributes.status.enum).toEqual(['queued', 'sent', 'failed', 'cancelled']);
  });

  it('registrations and history entries keep their schema', () => {
    expect(schema('registration-submission').attributes.email).toMatchObject({ type: 'string', required: true });
    expect(schema('history-entry').attributes.changes).toEqual({ type: 'json' });
  });
});

describe('Istoric lines without personal data (spec 2)', () => {
  it('"Date exportate" and "Date anonimizate"', () => {
    expect(historyTexts(HISTORY_ACTIONS.dataExported, {}, SUBJECT.athlete)).toEqual(['Date exportate']);
    expect(historyTexts(HISTORY_ACTIONS.dataAnonymized, {}, SUBJECT.athlete)).toEqual(['Date anonimizate']);
  });
});

describe('a cancelled e-mail job (spec 4)', () => {
  it('reads "Netrimis" in the panel and in the Sheet', () => {
    const status = readEmailStatus({ data: { status: 'cancelled', recipient: '', attempts: 0, documents: [] } });
    expect(status?.status).toBe('cancelled');
    expect(emailStatusText(status, () => '')).toBe('Netrimis');
    expect(emailStatusCell([{ status: 'cancelled', createdAt: '2026-10-27T10:00:00.000Z' }])).toBe('Netrimis');
  });
});

describe('3C copy (spec 4, 5, 7)', () => {
  it('counts take "de" from 20 (shared with the Sportivi list)', () => {
    expect(countWords(1, 'sportiv', 'sportivi')).toBe('1 sportiv');
    expect(countWords(20, 'sportiv', 'sportivi')).toBe('20 de sportivi');
    expect(countWords(101, 'sportiv', 'sportivi')).toBe('101 sportivi');
  });

  it('the confirmation is the spec text', () => {
    expect(C.dialog.title).toBe('Anonimizezi datele sportivului?');
    expect(C.dialog.removed).toBe(
      'Se șterg: numele, data nașterii, contactul, telefonul, e-mailul, notele, datele din înscrieri, documentele PDF, adresele din coada de e-mail, valorile vechi din Istoric și profilul public.',
    );
    expect(C.dialog.kept).toBe('Rămân: grupele pe sezoane, statusul A.C.S. și numărul de înscrieri.');
    expect(C.dialog.final).toBe('Acțiunea nu poate fi anulată.');
    expect(C.dialog.confirm).toBe('Anonimizează');
  });

  it('notice, filter option, bulk title, button and toasts', () => {
    expect(C.notice(3, 5)).toBe('3 sportivi inactivi de peste 5 ani.');
    expect(C.notice(1, 1)).toBe('1 sportiv inactiv de peste 1 an.');
    expect(C.notice(20, 20)).toBe('20 de sportivi inactivi de peste 20 de ani.');
    expect(C.inactiveOption(5)).toBe('Inactivi de peste 5 ani');
    expect(C.bulkTitle(4)).toBe('Anonimizezi datele pentru 4 sportivi?');
    expect(C.bulkButton(4)).toBe('Anonimizează (4)');
    expect(C.done(1)).toBe('1 sportiv anonimizat.');
    expect(C.done(4)).toBe('4 sportivi anonimizați.');
    expect(C.skipped(2)).toBe('Sărite: 2.');
    expect(C.failed(1)).toBe('Nereușite: 1.');
  });

  it('no em dash, middle dot, curly quotes or s/t with cedilla anywhere', () => {
    const texts = [JSON.stringify(C), C.notice(3, 5), C.bulkTitle(2), C.done(2), C.inactiveOption(5), C.pdf.generated('27.10.2026, 12:00', 'Ana')];
    for (const text of texts) expect(text).not.toMatch(/[\u2014\u00b7\u201e\u201c\u201d\u015f\u0163\u015e\u0162]/);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/personal-data/__tests__/foundation.test.ts`
Expected: FAIL (`Cannot find module '../copy'`).

- [ ] **Step 3: Schemas**

In `src/api/athlete/content-types/athlete/schema.json` replace the `status` line and add `anonymizedAt` after `dataIncomplete`:

```json
    "status": { "type": "enumeration", "enum": ["nou", "activ", "inactiv", "anonimizat"], "default": "activ", "required": true },
    "dataIncomplete": { "type": "boolean", "default": false },
    "anonymizedAt": { "type": "datetime" },
```

In `src/api/site-settings/content-types/site-settings/schema.json` add after `contact`:

```json
    "contact": {
      "type": "json",
      "customField": "plugin::component-preview.site-settings-contact"
    },
    "personalData": {
      "type": "json"
    }
```

In `src/api/email-job/content-types/email-job/schema.json` replace the `status` line:

```json
    "status": { "type": "enumeration", "enum": ["queued", "sent", "failed", "cancelled"], "required": true, "default": "queued" },
```

Then: `DATABASE_CLIENT=postgres npx strapi ts:generate-types` (writes `types/generated/contentTypes.d.ts`).

- [ ] **Step 4: Statuses, history actions, cancelled job**

`src/club/athlete-data.ts` lines 7-8:

```ts
export type AthleteStatus = 'nou' | 'activ' | 'inactiv' | 'anonimizat';
export const ATHLETE_STATUSES: readonly AthleteStatus[] = ['nou', 'activ', 'inactiv', 'anonimizat'];
```

`src/club/athletes/strapi-store.ts`: delete the local line `const ATHLETE_STATUSES: readonly AthleteStatus[] = ['nou', 'activ', 'inactiv'];` and change the import `import type { AthleteStatus } from '../athlete-data';` to `import { ATHLETE_STATUSES } from '../athlete-data';` (keep `type AthleteStatus` in the import only if `tsc` reports it still used).

`src/club/history-text.ts`: add two entries at the end of `HISTORY_ACTIONS` (after `duplicateDismissed`):

```ts
  duplicateDismissed: 'duplicate-dismissed',
  dataExported: 'data-exported',
  dataAnonymized: 'data-anonymized',
} as const;
```

replace `STATUS_WORDS`:

```ts
export const STATUS_WORDS: Record<AthleteStatus, string> = { nou: 'Nou', activ: 'Activ', inactiv: 'Inactiv', anonimizat: 'Anonimizat' };
```

and add two lines at the end of `RENDER` (after the `duplicateDismissed` line):

```ts
  [HISTORY_ACTIONS.dataExported]: () => ['Date exportate'],
  [HISTORY_ACTIONS.dataAnonymized]: () => ['Date anonimizate'],
```

`src/email/job-state.ts` line 14:

```ts
export type EmailJobStatus = 'queued' | 'sent' | 'failed' | 'cancelled';
```

`src/club/registration-panel.ts`: in `EmailStatus` change `status: 'queued' | 'sent' | 'failed' | 'none';` to `status: 'queued' | 'sent' | 'failed' | 'cancelled' | 'none';` and replace `const STATUSES = ['queued', 'sent', 'failed', 'none'] as const;` with:

```ts
const STATUSES = ['queued', 'sent', 'failed', 'cancelled', 'none'] as const;
```

(`emailStatusText` already answers "Netrimis" for anything not sent and not queued.)

`src/email/sheet-status.ts` line 10:

```ts
const STATUS_TEXT: Record<string, string> = { queued: 'Urmează să fie trimis', failed: 'Netrimis', cancelled: 'Netrimis' };
```

- [ ] **Step 5: `countWords` moves to its own module**

`src/club/ro-count.ts`:

```ts
/** Romanian "de" after 20, 100, 120, ... but not after 101 to 119 ("20 de sportivi", "101 sportivi"). Pure. */
const needsDe = (n: number): boolean => n >= 20 && (n % 100 === 0 || n % 100 >= 20);

export const countWords = (n: number, one: string, many: string): string => (n === 1 ? `1 ${one}` : `${n} ${needsDe(n) ? 'de ' : ''}${many}`);
```

In `src/club/sportivi/list-view.ts` delete the two lines

```ts
const needsDe = (n: number): boolean => n >= 20 && (n % 100 === 0 || n % 100 >= 20);
export const countWords = (n: number, one: string, many: string): string => (n === 1 ? `1 ${one}` : `${n} ${needsDe(n) ? 'de ' : ''}${many}`);
```

(and the comment line above them) and add, under the other imports:

```ts
import { countWords } from '../ro-count';

export { countWords };
```

- [ ] **Step 6: The copy module**

`src/club/personal-data/copy.ts`:

```ts
import { countWords } from '../ro-count';

const athletes = (n: number): string => countWords(n, 'sportiv', 'sportivi');
const years = (n: number): string => countWords(n, 'an', 'ani');

/** Every string of phase 3C (spec 7): Romanian, terse, straight quotes, no em dash, no middle dot. Pure: the admin bundle imports it. */
export const PERSONAL_DATA_COPY = {
  anonymizedName: 'Sportiv anonimizat',
  anonymizedChild: 'Anonimizat',
  menu: { export: 'Exportă datele', anonymize: 'Anonimizează' },
  exported: 'Datele au fost exportate.',
  dialog: {
    title: 'Anonimizezi datele sportivului?',
    removed:
      'Se șterg: numele, data nașterii, contactul, telefonul, e-mailul, notele, datele din înscrieri, documentele PDF, adresele din coada de e-mail, valorile vechi din Istoric și profilul public.',
    kept: 'Rămân: grupele pe sezoane, statusul A.C.S. și numărul de înscrieri.',
    final: 'Acțiunea nu poate fi anulată.',
    confirm: 'Anonimizează',
    busy: 'Se anonimizează...',
  },
  bulkTitle: (k: number) => `Anonimizezi datele pentru ${athletes(k)}?`,
  bulkButton: (k: number) => `Anonimizează (${k})`,
  done: (k: number) => (k === 1 ? '1 sportiv anonimizat.' : `${athletes(k)} anonimizați.`),
  skipped: (n: number) => `Sărite: ${n}.`,
  failed: (n: number) => `Nereușite: ${n}.`,
  selectAll: 'Selectează tot',
  filterSection: 'Date personale',
  inactiveOption: (n: number) => `Inactivi de peste ${years(n)}`,
  notice: (count: number, n: number) => `${count === 1 ? '1 sportiv inactiv' : `${athletes(count)} inactivi`} de peste ${years(n)}.`,
  noticeLink: 'Vezi lista',
  noticeHide: 'Ascunde până la sezonul următor',
  settingsCard: 'Date personale',
  settingsField: 'Ani până la anonimizare',
  missingDocument: 'Document indisponibil',
  pdf: {
    title: 'Date personale',
    athlete: 'Sportiv',
    groups: 'Grupe pe sezoane',
    acs: 'Membru A.C.S. pe sezoane',
    registrations: 'Înscrieri',
    registration: 'Înscrierea',
    history: 'Istoric',
    season: 'Sezon',
    school: 'Școala',
    status: 'Status',
    notes: 'Note',
    submittedAt: 'Trimisă la',
    mainGroup: 'principală',
    none: 'Nimic înregistrat.',
    generated: (when: string, who: string) => `Generat la ${when}, de ${who}.`,
  },
} as const;
```

- [ ] **Step 7: Run the tests and the checks**

Run: `npx vitest run src/club/personal-data/__tests__/foundation.test.ts` then `npx vitest run` then `npx tsc --noEmit`
Expected: PASS, full suite PASS (the list-view count tests still pass through the re-export), zero type errors. If `tsc` reports a `Record<AthleteStatus, ...>` missing `anonimizat` elsewhere, add the `anonimizat` entry with the word "Anonimizat".

- [ ] **Step 8: Commit**

```bash
git add src/api/athlete src/api/site-settings src/api/email-job types/generated src/club/athlete-data.ts src/club/history-text.ts src/club/athletes/strapi-store.ts src/email/job-state.ts src/email/sheet-status.ts src/club/registration-panel.ts src/club/ro-count.ts src/club/sportivi/list-view.ts src/club/personal-data
git commit -m "feat(personal-data): 3C schemas, anonymized status, history actions and copy"
```

---

### Task 2: Settings reader and the inactivity rule

**Files:**
- Create: `src/club/personal-data/settings.ts`, `src/club/personal-data/inactivity.ts`
- Test: `src/club/personal-data/__tests__/settings-inactivity.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (own minimal input types, so this task runs before the store changes).
- Produces (`settings.ts`, pure, imported by the admin bundle too):
  - `DEFAULT_RETENTION_YEARS = 5`, `RETENTION_BOUNDS = { min: 1, max: 20 }`
  - `type PersonalDataSettings = { retentionYears: number; reviewHiddenUntilSeason: string | null }`
  - `type InactiveSummary = { retentionYears: number; count: number; seasonLabel: string | null; shown: boolean }`
  - `retentionYearsOf(v: unknown): number`, `readPersonalDataSettings(raw: unknown): PersonalDataSettings`
  - `hiddenUntil(s: PersonalDataSettings, seasonLabel: string): PersonalDataSettings`
  - `reviewNoticeShown(s: PersonalDataSettings, count: number, seasonLabel: string | null): boolean`
- Produces (`inactivity.ts`):
  - `seasonStartYear(label: string | null): number | null`
  - `type InactivityInput = { athletes: { id: string; status: string; createdAt: string }[]; memberships: { athleteId: string; seasonId: string }[]; registrations: { athleteId: string | null; seasonId: string | null; season: string | null }[]; seasons: { id: string; label: string; isCurrent: boolean }[]; retentionYears: number; now: Date }` (store rows of Task 5 satisfy it)
  - `lastActiveYears(input): Map<string, number>`, `inactiveAthleteIds(input: InactivityInput): Set<string>`

- [ ] **Step 1: Write the failing test**

`src/club/personal-data/__tests__/settings-inactivity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { inactiveAthleteIds, lastActiveYears, seasonStartYear, type InactivityInput } from '../inactivity';
import { DEFAULT_RETENTION_YEARS, hiddenUntil, readPersonalDataSettings, retentionYearsOf, reviewNoticeShown } from '../settings';

describe('settings reader (spec 2)', () => {
  it('defaults to 5 years and no hidden review', () => {
    expect(DEFAULT_RETENTION_YEARS).toBe(5);
    expect(readPersonalDataSettings(null)).toEqual({ retentionYears: 5, reviewHiddenUntilSeason: null });
    expect(readPersonalDataSettings({})).toEqual({ retentionYears: 5, reviewHiddenUntilSeason: null });
    expect(readPersonalDataSettings([3])).toEqual({ retentionYears: 5, reviewHiddenUntilSeason: null });
  });

  it('keeps 1 to 20, clamps outside, reads anything else as 5', () => {
    expect(retentionYearsOf(7)).toBe(7);
    expect(retentionYearsOf(1)).toBe(1);
    expect(retentionYearsOf(20)).toBe(20);
    expect(retentionYearsOf(0)).toBe(1);
    expect(retentionYearsOf(25)).toBe(20);
    expect(retentionYearsOf(2.5)).toBe(5);
    expect(retentionYearsOf('7')).toBe(5);
  });

  it('reads and writes the season the review is hidden for', () => {
    const s = readPersonalDataSettings({ retentionYears: 6, reviewHiddenUntilSeason: '2026-2027' });
    expect(s).toEqual({ retentionYears: 6, reviewHiddenUntilSeason: '2026-2027' });
    expect(readPersonalDataSettings({ reviewHiddenUntilSeason: '' }).reviewHiddenUntilSeason).toBeNull();
    expect(hiddenUntil({ retentionYears: 5, reviewHiddenUntilSeason: null }, '2027-2028')).toEqual({ retentionYears: 5, reviewHiddenUntilSeason: '2027-2028' });
  });

  it('shows the notice while the count is not zero and the review is not hidden this season', () => {
    const open = { retentionYears: 5, reviewHiddenUntilSeason: null };
    const hidden = { retentionYears: 5, reviewHiddenUntilSeason: '2026-2027' };
    expect(reviewNoticeShown(open, 3, '2026-2027')).toBe(true);
    expect(reviewNoticeShown(open, 0, '2026-2027')).toBe(false);
    expect(reviewNoticeShown(hidden, 3, '2026-2027')).toBe(false);
    expect(reviewNoticeShown(hidden, 3, '2027-2028')).toBe(true);
    expect(reviewNoticeShown(hidden, 3, null)).toBe(true);
  });
});

const SEASONS = [
  { id: 's19', label: '2019-2020', isCurrent: false },
  { id: 's20', label: '2020-2021', isCurrent: false },
  { id: 's21', label: '2021-2022', isCurrent: false },
  { id: 's22', label: '2022-2023', isCurrent: false },
  { id: 's25', label: '2025-2026', isCurrent: false },
  { id: 's26', label: '2026-2027', isCurrent: true },
  { id: 'sx', label: 'toamna', isCurrent: false },
];
const NOW = new Date('2026-10-27T09:00:00.000Z');
const RECENT = '2026-09-01T10:00:00.000Z';
const athlete = (id: string, over: Partial<{ status: string; createdAt: string }> = {}) => ({ id, status: 'activ', createdAt: RECENT, ...over });
const input = (over: Partial<InactivityInput>): InactivityInput => ({ athletes: [], memberships: [], registrations: [], seasons: SEASONS, retentionYears: 5, now: NOW, ...over });
const member = (athleteId: string, seasonId: string) => ({ athleteId, seasonId });
const reg = (athleteId: string | null, seasonId: string | null, season: string | null = null) => ({ athleteId, seasonId, season });

describe('inactivity rule (spec 5)', () => {
  it('reads the start year of a season label', () => {
    expect(seasonStartYear('2026-2027')).toBe(2026);
    expect(seasonStartYear('2026/2027')).toBe(2026);
    expect(seasonStartYear('toamna')).toBeNull();
    expect(seasonStartYear(null)).toBeNull();
  });

  it('the last active season is the latest of group seasons and linked registration seasons', () => {
    const years = lastActiveYears({
      seasons: SEASONS,
      memberships: [member('a', 's19'), member('b', 's21')],
      registrations: [reg('a', 's22'), reg('b', null, '2020-2021'), reg(null, 's26')],
    });
    expect(years).toEqual(new Map([['a', 2022], ['b', 2021]]));
  });

  it('qualifies at exactly N seasons before the current one, not at N - 1', () => {
    const ids = inactiveAthleteIds(input({
      athletes: [athlete('five'), athlete('four')],
      memberships: [member('five', 's21'), member('four', 's22')],
    }));
    expect([...ids]).toEqual(['five']);
  });

  it('a registration season counts like a group season; the latest activity wins', () => {
    const ids = inactiveAthleteIds(input({
      athletes: [athlete('regOnly'), athlete('textSeason'), athlete('later')],
      registrations: [reg('regOnly', 's20'), reg('textSeason', null, '2021-2022'), reg('later', 's25')],
      memberships: [member('later', 's19')],
    }));
    expect([...ids].sort()).toEqual(['regOnly', 'textSeason']);
  });

  it('no activity: the record must be at least N years old', () => {
    const ids = inactiveAthleteIds(input({
      athletes: [athlete('old', { createdAt: '2021-10-27T09:00:00.000Z' }), athlete('young', { createdAt: '2021-10-28T09:00:00.000Z' }), athlete('new')],
    }));
    expect([...ids]).toEqual(['old']);
  });

  it('a season label without a year is no activity', () => {
    const ids = inactiveAthleteIds(input({ athletes: [athlete('x', { createdAt: RECENT })], registrations: [reg('x', 'sx')] }));
    expect(ids.size).toBe(0);
  });

  it('never lists an anonymized athlete; no current season lists nobody', () => {
    expect(inactiveAthleteIds(input({ athletes: [athlete('anon', { status: 'anonimizat' })], memberships: [member('anon', 's19')] })).size).toBe(0);
    const noCurrent = SEASONS.map((s) => ({ ...s, isCurrent: false }));
    expect(inactiveAthleteIds(input({ seasons: noCurrent, athletes: [athlete('a')], memberships: [member('a', 's19')] })).size).toBe(0);
  });

  it('follows the retention setting', () => {
    const one = inactiveAthleteIds(input({ retentionYears: 1, athletes: [athlete('a')], memberships: [member('a', 's25')] }));
    expect([...one]).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/personal-data/__tests__/settings-inactivity.test.ts`
Expected: FAIL (`Cannot find module '../inactivity'`).

- [ ] **Step 3: `settings.ts`**

```ts
/** "Ani până la anonimizare" and the yearly review notice (spec 2, 5). Pure: the admin bundle imports it too. */
export const DEFAULT_RETENTION_YEARS = 5;
export const RETENTION_BOUNDS = { min: 1, max: 20 } as const;

/** site-settings.personalData, as stored (a `type`, so it can be written to the json attribute). */
export type PersonalDataSettings = { retentionYears: number; reviewHiddenUntilSeason: string | null };

/** GET /api/club/athletes/inactive-summary: what the dashboard notice needs. */
export type InactiveSummary = { retentionYears: number; count: number; seasonLabel: string | null; shown: boolean };

const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** A whole number is kept between 1 and 20; anything else is the default (decided while planning, item 8). */
export function retentionYearsOf(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) return DEFAULT_RETENTION_YEARS;
  return Math.min(RETENTION_BOUNDS.max, Math.max(RETENTION_BOUNDS.min, v));
}

export function readPersonalDataSettings(raw: unknown): PersonalDataSettings {
  const r = record(raw);
  const hidden = typeof r.reviewHiddenUntilSeason === 'string' && r.reviewHiddenUntilSeason ? r.reviewHiddenUntilSeason : null;
  return { retentionYears: retentionYearsOf(r.retentionYears), reviewHiddenUntilSeason: hidden };
}

/** "Ascunde până la sezonul următor": the notice stays hidden while `seasonLabel` is the current season. */
export const hiddenUntil = (s: PersonalDataSettings, seasonLabel: string): PersonalDataSettings => ({ ...s, reviewHiddenUntilSeason: seasonLabel });

export const reviewNoticeShown = (s: PersonalDataSettings, count: number, seasonLabel: string | null): boolean =>
  count > 0 && (seasonLabel === null || s.reviewHiddenUntilSeason !== seasonLabel);
```

- [ ] **Step 4: `inactivity.ts`**

```ts
/**
 * "Inactivi de peste N ani" (spec 5): not anonymized, and the last active season at least N seasons before the current
 * one; the last active season is the latest of the group seasons and the linked registration seasons (phase 5 adds
 * attendance and payment seasons in `lastActiveYears`, the one place to extend). No activity at all: the record is at
 * least N years old. Pure.
 */
export type InactivityInput = {
  athletes: { id: string; status: string; createdAt: string }[];
  memberships: { athleteId: string; seasonId: string }[];
  registrations: { athleteId: string | null; seasonId: string | null; season: string | null }[];
  seasons: { id: string; label: string; isCurrent: boolean }[];
  retentionYears: number;
  now: Date;
};

/** "2026-2027" -> 2026; a label that does not start with a year is no season (decided while planning, item 7). */
export function seasonStartYear(label: string | null): number | null {
  const m = /^(\d{4})/.exec(label ?? '');
  return m ? Number(m[1]) : null;
}

export function lastActiveYears(input: Pick<InactivityInput, 'memberships' | 'registrations' | 'seasons'>): Map<string, number> {
  const labels = new Map(input.seasons.map((s) => [s.id, s.label]));
  const years = new Map<string, number>();
  const note = (athleteId: string | null, label: string | null | undefined) => {
    const year = seasonStartYear(label ?? null);
    if (athleteId && year !== null) years.set(athleteId, Math.max(years.get(athleteId) ?? year, year));
  };
  for (const m of input.memberships) note(m.athleteId, labels.get(m.seasonId));
  for (const r of input.registrations) note(r.athleteId, (r.seasonId && labels.get(r.seasonId)) || r.season);
  return years;
}

/** Today minus N years, as a time stamp (UTC calendar date). */
const yearsBefore = (now: Date, n: number): number => Date.UTC(now.getUTCFullYear() - n, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59);

function qualifies(createdAt: string, lastYear: number | undefined, current: number, input: InactivityInput): boolean {
  if (lastYear !== undefined) return current - lastYear >= input.retentionYears;
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && created <= yearsBefore(input.now, input.retentionYears);
}

export function inactiveAthleteIds(input: InactivityInput): Set<string> {
  const current = seasonStartYear(input.seasons.find((s) => s.isCurrent)?.label ?? null);
  if (current === null) return new Set();
  const last = lastActiveYears(input);
  const listed = input.athletes.filter((a) => a.status !== 'anonimizat' && qualifies(a.createdAt, last.get(a.id), current, input));
  return new Set(listed.map((a) => a.id));
}
```

- [ ] **Step 5: Run the tests and the checks**

Run: `npx vitest run src/club/personal-data/__tests__/settings-inactivity.test.ts`, `npx vitest run`, `npx tsc --noEmit`
Expected: PASS, PASS, zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/club/personal-data/settings.ts src/club/personal-data/inactivity.ts src/club/personal-data/__tests__/settings-inactivity.test.ts
git commit -m "feat(personal-data): retention setting reader and inactivity rule"
```

---
### Task 3: Anonymize planner and history scrubbing

**Files:**
- Create: `src/club/personal-data/anonymize-plan.ts`
- Test: `src/club/personal-data/__tests__/anonymize-plan.test.ts`

**Interfaces:**
- Consumes: Task 1 `PERSONAL_DATA_COPY.anonymizedName`, `.anonymizedChild`; `ConfirmationRecord` (`src/club/confirm/plan.ts`).
- Produces (pure):
  - `ATHLETE_PERSONAL_KEYS`, `REGISTRATION_NULLED_KEYS`, `REGISTRATION_KEPT_KEYS` (readonly string tuples), `HISTORY_PERSONAL_KEYS: ReadonlySet<string>`
  - `type AthleteScrub = { name: string; firstName: null; lastName: null; birthDate: null; contactName: null; phone: null; email: null; notes: null; dataIncomplete: false; status: 'anonimizat'; anonymizedAt: string; profileId: null }`, `athleteScrub(at: string): AthleteScrub`
  - `type RegistrationScrub = { [K in REGISTRATION_NULLED_KEYS]: null } & { childName: string; confirmation: ConfirmationRecord | null }`, `registrationScrub(confirmation: ConfirmationRecord | null): RegistrationScrub`
  - `scrubChanges(changes: Record<string, unknown>): Record<string, unknown>`
  - `scrubbedJobStatus(status: string): string` (`queued` -> `cancelled`, others unchanged)
  - `isAnonymized(a: { status: string } | null | undefined): boolean`
  - `MAX_BULK = 200`, `readAnonymizeIds(body: unknown): string[] | null`
  - `type BulkAnonymizeResult = { anonymized: number; skipped: number; failed: number }`

- [ ] **Step 1: Write the failing test**

`src/club/personal-data/__tests__/anonymize-plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ConfirmationRecord } from '../../confirm/plan';
import {
  ATHLETE_PERSONAL_KEYS, MAX_BULK, REGISTRATION_KEPT_KEYS, REGISTRATION_NULLED_KEYS, athleteScrub, isAnonymized, readAnonymizeIds, registrationScrub,
  scrubChanges, scrubbedJobStatus,
} from '../anonymize-plan';

const CONFIRMATION: ConfirmationRecord = {
  athleteId: 'a1', createdAthlete: false, previousStatus: 'Contactat', athleteStatusBefore: 'activ',
  fieldsBefore: { phone: '0722111222', email: 'ana@example.com' }, fieldsAfter: { phone: '0733444555' },
  membershipId: 'gm1', demotedMainId: null, promotedMainId: null, acs: { id: 'acs1', previous: 'nu' }, seasonId: 's26', at: '2026-10-03T11:22:00.000Z',
};

describe('athlete scrub (spec 4)', () => {
  it('empties every personal field and marks the record anonymized', () => {
    const s = athleteScrub('2026-10-27T09:00:00.000Z');
    for (const key of ATHLETE_PERSONAL_KEYS.filter((k) => k !== 'name')) expect(s[key], key).toBeNull();
    expect(s).toMatchObject({ name: 'Sportiv anonimizat', dataIncomplete: false, status: 'anonimizat', anonymizedAt: '2026-10-27T09:00:00.000Z', profileId: null });
  });
});

describe('registration scrub (spec 4)', () => {
  it('nulls every personal field, writes "Anonimizat" as the child name and touches no kept field', () => {
    const s = registrationScrub(null);
    for (const key of REGISTRATION_NULLED_KEYS) expect(s[key], key).toBeNull();
    expect(s.childName).toBe('Anonimizat');
    expect(s.confirmation).toBeNull();
    for (const key of REGISTRATION_KEPT_KEYS) expect(Object.keys(s), key).not.toContain(key);
  });

  it('keeps the confirmation record, its personal values blanked', () => {
    const s = registrationScrub(CONFIRMATION);
    expect(s.confirmation).toEqual({ ...CONFIRMATION, fieldsBefore: { phone: null, email: null }, fieldsAfter: { phone: null } });
  });
});

describe('history scrubbing (spec 4)', () => {
  it('an old -> new pair under a personal key keeps its shape with both sides null', () => {
    expect(scrubChanges({ fields: { phone: { from: '0722', to: '0733' }, status: { from: 'Nou', to: 'Contactat' } } }))
      .toEqual({ fields: { phone: { from: null, to: null }, status: { from: 'Nou', to: 'Contactat' } } });
  });

  it('plain personal values become null, the rest is kept', () => {
    expect(scrubChanges({ name: 'Ilinca Pop' })).toEqual({ name: null });
    expect(scrubChanges({ athleteName: 'Ilinca Pop', createdAthlete: false, groupName: 'Începători' })).toEqual({ athleteName: null, createdAthlete: false, groupName: 'Începători' });
    expect(scrubChanges({ recipient: 'ana@example.com', documents: ['Ilinca-Pop_Acord_2026-2027.pdf'] })).toEqual({ recipient: null, documents: null });
    expect(scrubChanges({ registrationNumber: '2026-0142', schoolName: 'AFI' })).toEqual({ registrationNumber: '2026-0142', schoolName: 'AFI' });
    expect(scrubChanges({ fields: { childName: { from: '', to: 'Ilinca' }, parentName: { from: 'Ana', to: 'Dana' }, contactName: { from: null, to: 'Dana' } } }))
      .toEqual({ fields: { childName: { from: null, to: null }, parentName: { from: null, to: null }, contactName: { from: null, to: null } } });
  });

  it('is stable: scrubbing twice changes nothing more', () => {
    const once = scrubChanges({ fields: { email: { from: 'a@x.ro', to: 'b@x.ro' } }, recipient: 'a@x.ro' });
    expect(scrubChanges(once)).toEqual(once);
  });
});

describe('e-mail jobs, guards, bulk body', () => {
  it('a queued job is cancelled; sent and failed stay', () => {
    expect(scrubbedJobStatus('queued')).toBe('cancelled');
    expect(scrubbedJobStatus('sent')).toBe('sent');
    expect(scrubbedJobStatus('failed')).toBe('failed');
  });

  it('knows an anonymized athlete', () => {
    expect(isAnonymized({ status: 'anonimizat' })).toBe(true);
    expect(isAnonymized({ status: 'inactiv' })).toBe(false);
    expect(isAnonymized(null)).toBe(false);
  });

  it('reads 1 to 200 ids, without repeats', () => {
    expect(readAnonymizeIds({ documentIds: ['a', 'b', 'a'] })).toEqual(['a', 'b']);
    expect(readAnonymizeIds({ documentIds: [] })).toBeNull();
    expect(readAnonymizeIds({ documentIds: ['a', ''] })).toBeNull();
    expect(readAnonymizeIds({ documentIds: ['a', 3] })).toBeNull();
    expect(readAnonymizeIds({ documentIds: Array.from({ length: MAX_BULK + 1 }, (_, i) => `id${i}`) })).toBeNull();
    expect(readAnonymizeIds({ documentIds: Array.from({ length: MAX_BULK }, (_, i) => `id${i}`) })).toHaveLength(MAX_BULK);
    expect(readAnonymizeIds(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/personal-data/__tests__/anonymize-plan.test.ts`
Expected: FAIL (`Cannot find module '../anonymize-plan'`).

- [ ] **Step 3: Implement**

`src/club/personal-data/anonymize-plan.ts`:

```ts
import type { ConfirmationRecord } from '../confirm/plan';
import { PERSONAL_DATA_COPY } from './copy';

/** What "Anonimizează" writes (spec 4). Pure: the services apply it inside one transaction per athlete. */
export const ATHLETE_PERSONAL_KEYS = ['name', 'firstName', 'lastName', 'birthDate', 'contactName', 'phone', 'email', 'notes'] as const;
export const REGISTRATION_NULLED_KEYS = [
  'parentName', 'email', 'phone', 'childBirthDate', 'childBirthDateParsed', 'childHeight', 'shirtSize', 'priorExperience', 'expectations',
  'relationshipOther', 'sourceOther', 'internalNote', 'lastSeason', 'extra', 'submissionKey',
] as const;
export const REGISTRATION_KEPT_KEYS = [
  'registrationNumber', 'season', 'seasonRef', 'section', 'status', 'archived', 'submittedAt', 'level', 'relationship', 'howHeard', 'source',
  'membershipAnswer', 'subscriptionChoice', 'gdprConsent', 'regulationsConsent', 'clubInterest', 'regulationsAgreement', 'privacyConsent', 'athlete',
] as const;

/** Keys whose values in Istoric and in a confirmation record are personal (spec 4, plus decided item 4). */
export const HISTORY_PERSONAL_KEYS: ReadonlySet<string> = new Set<string>([
  ...ATHLETE_PERSONAL_KEYS, ...REGISTRATION_NULLED_KEYS, 'childName', 'athleteName', 'recipient', 'documents',
]);

export const MAX_BULK = 200;
export type BulkAnonymizeResult = { anonymized: number; skipped: number; failed: number };

export type AthleteScrub = {
  name: string; firstName: null; lastName: null; birthDate: null; contactName: null; phone: null; email: null; notes: null;
  dataIncomplete: false; status: 'anonimizat'; anonymizedAt: string; profileId: null;
};

export const athleteScrub = (at: string): AthleteScrub => ({
  name: PERSONAL_DATA_COPY.anonymizedName, firstName: null, lastName: null, birthDate: null, contactName: null, phone: null, email: null, notes: null,
  dataIncomplete: false, status: 'anonimizat', anonymizedAt: at, profileId: null,
});

type Nulled = { [K in (typeof REGISTRATION_NULLED_KEYS)[number]]: null };
export type RegistrationScrub = Nulled & { childName: string; confirmation: ConfirmationRecord | null };

type Changes = Record<string, unknown>;
const isPlainObject = (v: unknown): v is Changes => !!v && typeof v === 'object' && !Array.isArray(v);
const isPair = (v: unknown): v is Changes => isPlainObject(v) && 'from' in v && 'to' in v;
const scrubValue = (v: unknown): unknown => (isPair(v) ? { ...v, from: null, to: null } : null);

/** Every value under a personal key becomes null (a pair keeps its shape); other keys kept; nested objects walked. */
export function scrubChanges(changes: Changes): Changes {
  return Object.fromEntries(
    Object.entries(changes).map(([key, v]) => [key, HISTORY_PERSONAL_KEYS.has(key) ? scrubValue(v) : isPlainObject(v) ? scrubChanges(v) : v]),
  );
}

export function registrationScrub(confirmation: ConfirmationRecord | null): RegistrationScrub {
  const nulled = Object.fromEntries(REGISTRATION_NULLED_KEYS.map((k) => [k, null])) as Nulled;
  const kept = confirmation ? (scrubChanges(confirmation) as ConfirmationRecord) : null;
  return { ...nulled, childName: PERSONAL_DATA_COPY.anonymizedChild, confirmation: kept };
}

/** Jobs not yet sent are cancelled; sent and failed keep their status (spec 4). */
export const scrubbedJobStatus = (status: string): string => (status === 'queued' ? 'cancelled' : status);

export const isAnonymized = (a: { status: string } | null | undefined): boolean => a?.status === 'anonimizat';

/** POST /api/club/athletes/anonymize body `{ documentIds }`: 1 to 200 non-empty ids, repeats dropped; anything else null (400). */
export function readAnonymizeIds(body: unknown): string[] | null {
  const raw = isPlainObject(body) ? body.documentIds : null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BULK) return null;
  if (!raw.every((id) => typeof id === 'string' && id.trim() !== '')) return null;
  return [...new Set(raw as string[])];
}
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run src/club/personal-data/__tests__/anonymize-plan.test.ts`, `npx vitest run`, `npx tsc --noEmit`
Expected: PASS, PASS, zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/personal-data/anonymize-plan.ts src/club/personal-data/__tests__/anonymize-plan.test.ts
git commit -m "feat(personal-data): anonymize planner and history scrubbing"
```

---

### Task 4: Export summary model and PDF

**Files:**
- Create: `src/club/personal-data/summary-model.ts`, `src/club/personal-data/summary-pdf.ts`
- Test: `src/club/personal-data/__tests__/summary.test.ts`

**Interfaces:**
- Consumes: Task 1 `PERSONAL_DATA_COPY.pdf`, `.missingDocument`, `STATUS_WORDS`; existing `ATHLETE_FIELD_LABELS`, `birthDateForPicker` (`athlete-data.ts`), `ACS_WORDS` (`acs.ts`), `dateTabRows`, `abonamentTabRows` (`inscrieri-panel.ts`, the panel's Date tab and the consents), `DOCUMENT_LABELS`, `formatEmailSentAt` (`registration-panel.ts`), `historyWhen` (`sportivi/record-view.ts`), the PDF tools `drawFooter`, `footerTop` (`documents/pdf/frame.ts`), `drawLabel`, `drawParagraph`, `hLine`, `paragraphHeight`, `ParagraphStyle` (`pdf/draw.ts`), `COLOR`, `CONTENT_WIDTH`, `FONT`, `MARGIN`, `PAGE`, `px`, `registerFonts` (`pdf/style.ts`), `b`, `t` (`documents/runs.ts`).
- Produces:
  - `type SummaryRegistration = { number: string; record: Record<string, unknown>; seasonLabel: string | null; sectionName: string | null; missingDocuments: DocumentKind[] }`
  - `type SummaryInput = { athlete: { name: string | null; birthDate: string | null; contactName: string | null; phone: string | null; email: string | null; status: AthleteStatus; notes: string | null }; groups: { season: string; group: string; main: boolean }[]; acs: { season: string; state: AcsState }[]; registrations: SummaryRegistration[]; history: { at: string; actor: string; text: string; subject: string }[]; generatedAt: Date; generatedBy: string }`
  - `type SummaryRow = { label: string; value: string }`, `SummaryBlock = { heading: string | null; rows: SummaryRow[] }`, `SummarySection = { title: string; blocks: SummaryBlock[] }`, `SummaryModel = { title: string; name: string; sections: SummarySection[]; footer: string }`
  - `buildSummaryModel(input: SummaryInput): SummaryModel`
  - `renderSummaryPdf(model: SummaryModel): Promise<Buffer>` (A4, as many pages as needed, wordmark and association footer on every page)

- [ ] **Step 1: Write the failing test**

`src/club/personal-data/__tests__/summary.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { pdfText } from '../../documents/__tests__/pdf-text';
import { buildSummaryModel, type SummaryInput } from '../summary-model';
import { renderSummaryPdf } from '../summary-pdf';

vi.setConfig({ testTimeout: 30_000 });

const RECORD = {
  documentId: 'r1', registrationNumber: '2026-0142', status: 'Confirmat', childName: 'Ilinca Zamfirescu', childBirthDate: '27.04.2013',
  parentName: 'Dana Zamfirescu', relationship: 'parinte', phone: '0799 123 456', email: 'dana@example.com', childHeight: 142, shirtSize: 'S',
  lastSeason: 'Începători', priorExperience: 'Pași înainte', expectations: 'Să sară', membershipAnswer: 'da', source: 'Facebook',
  gdprConsent: true, regulationsConsent: true, submittedAt: '2026-10-03T11:22:00.000Z',
};

const INPUT: SummaryInput = {
  athlete: { name: 'Ilinca Zamfirescu', birthDate: '2013-04-27', contactName: 'Dana Zamfirescu', phone: '0799 123 456', email: 'dana@example.com', status: 'activ', notes: 'Alergie la polen' },
  groups: [{ season: '2026-2027', group: 'Începători', main: true }, { season: '2026-2027', group: 'Club', main: false }],
  acs: [{ season: '2026-2027', state: 'da' }],
  registrations: [{ number: '2026-0142', record: RECORD, seasonLabel: '2026-2027', sectionName: 'Școala de patinaj', missingDocuments: ['adeziune'] }],
  history: [{ at: '2026-10-20T10:00:00.000Z', actor: 'Ana Admin', text: 'Telefon: "0799 000 111" → "0799 123 456"', subject: '' },
    { at: '2026-10-03T11:22:00.000Z', actor: '', text: 'Înscriere înregistrată', subject: '2026-0142' }],
  generatedAt: new Date('2026-10-27T10:00:00.000Z'),
  generatedBy: 'Ana Admin',
};

const rows = (model: ReturnType<typeof buildSummaryModel>, title: string) => model.sections.find((s) => s.title === title)!.blocks.flatMap((b) => b.rows);

describe('summary model (spec 3)', () => {
  const model = buildSummaryModel(INPUT);

  it('sections in the spec order, title with the name, the generated line', () => {
    expect(model.sections.map((s) => s.title)).toEqual(['Sportiv', 'Grupe pe sezoane', 'Membru A.C.S. pe sezoane', 'Înscrieri', 'Istoric']);
    expect(model.title).toBe('Date personale');
    expect(model.name).toBe('Ilinca Zamfirescu');
    expect(model.footer).toBe('Generat la 27.10.2026, 12:00, de Ana Admin.');
  });

  it('Sportiv: name, birth date, contact, phone, e-mail, status, notes', () => {
    expect(rows(model, 'Sportiv')).toEqual([
      { label: 'Nume și prenume', value: 'Ilinca Zamfirescu' }, { label: 'Data nașterii', value: '27.04.2013' },
      { label: 'Persoana de contact', value: 'Dana Zamfirescu' }, { label: 'Telefon', value: '0799 123 456' },
      { label: 'E-mail', value: 'dana@example.com' }, { label: 'Status', value: 'Activ' }, { label: 'Note', value: 'Alergie la polen' },
    ]);
  });

  it('groups with the main one marked; A.C.S. in words', () => {
    expect(rows(model, 'Grupe pe sezoane')).toEqual([{ label: '2026-2027', value: 'Începători, principală' }, { label: '2026-2027', value: 'Club' }]);
    expect(rows(model, 'Membru A.C.S. pe sezoane')).toEqual([{ label: '2026-2027', value: 'Da' }]);
  });

  it('each registration: number, season, school, status, every Date tab answer, consents, submitted at, missing documents', () => {
    const block = model.sections.find((s) => s.title === 'Înscrieri')!.blocks[0];
    expect(block.heading).toBe('Înscrierea 2026-0142');
    const byLabel = Object.fromEntries(block.rows.map((r) => [r.label, r.value]));
    expect(byLabel).toMatchObject({
      Sezon: '2026-2027', Școala: 'Școala de patinaj', Status: 'Confirmat', 'Numele copilului': 'Ilinca Zamfirescu', 'Telefon de contact': '0799 123 456',
      'Înălțimea copilului (cm)': '142', 'Trimisă la': '03.10.2026, 14:22', 'Cerere de adeziune': 'Document indisponibil',
    });
    expect(block.rows.filter((r) => r.value === 'Da').length).toBeGreaterThanOrEqual(2);
  });

  it('Istoric: date and actor, then the line; registration lines name the registration', () => {
    expect(rows(model, 'Istoric')).toEqual([
      { label: '20 oct 2026, 13:00, Ana Admin', value: 'Telefon: "0799 000 111" → "0799 123 456"' },
      { label: '3 oct 2026, 14:22', value: 'Înscrierea 2026-0142: Înscriere înregistrată' },
    ]);
  });

  it('an empty section says so', () => {
    const empty = buildSummaryModel({ ...INPUT, groups: [], acs: [], registrations: [], history: [] });
    for (const title of ['Grupe pe sezoane', 'Membru A.C.S. pe sezoane', 'Înscrieri', 'Istoric']) expect(rows(empty, title)).toEqual([{ label: '', value: 'Nimic înregistrat.' }]);
  });
});

describe('summary PDF (spec 3)', () => {
  it('reads back every section with the Romanian letters', async () => {
    const { text } = await pdfText(await renderSummaryPdf(buildSummaryModel(INPUT)));
    for (const part of ['Date personale: Ilinca Zamfirescu', 'Grupe pe sezoane', 'Membru A.C.S. pe sezoane', 'Înscrierea 2026-0142', 'Istoric',
      '0799 123 456', 'Document indisponibil', 'Generat la 27.10.2026, 12:00, de Ana Admin.', 'C.I.F.: 30321550']) {
      expect(text).toContain(part);
    }
    for (const letter of ['ș', 'ț', 'ă', 'î', 'Î']) expect(text).toContain(letter);
  });

  it('a long Istoric flows onto more pages, every line kept', async () => {
    const history = Array.from({ length: 120 }, (_, i) => ({ at: '2026-10-20T10:00:00.000Z', actor: 'Ana Admin', text: `Linia ${i + 1}`, subject: '' }));
    const { pages, text } = await pdfText(await renderSummaryPdf(buildSummaryModel({ ...INPUT, history })));
    expect(pages).toBeGreaterThan(1);
    expect(text).toContain('Linia 1 ');
    expect(text).toContain('Linia 120');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/personal-data/__tests__/summary.test.ts`
Expected: FAIL (`Cannot find module '../summary-model'`).

- [ ] **Step 3: `summary-model.ts`**

```ts
import { ACS_WORDS, type AcsState } from '../acs';
import { ATHLETE_FIELD_LABELS, birthDateForPicker, type AthleteStatus } from '../athlete-data';
import type { DocumentKind } from '../documents/types';
import { STATUS_WORDS } from '../history-text';
import { abonamentTabRows, dateTabRows } from '../inscrieri-panel';
import { DOCUMENT_LABELS, formatEmailSentAt } from '../registration-panel';
import { historyWhen } from '../sportivi/record-view';
import { PERSONAL_DATA_COPY } from './copy';

/** "rezumat.pdf" of "Exportă datele" (spec 3) as rows; the PDF only draws them. Pure. */
export type SummaryRow = { label: string; value: string };
export type SummaryBlock = { heading: string | null; rows: SummaryRow[] };
export type SummarySection = { title: string; blocks: SummaryBlock[] };
export type SummaryModel = { title: string; name: string; sections: SummarySection[]; footer: string };

export type SummaryRegistration = { number: string; record: Record<string, unknown>; seasonLabel: string | null; sectionName: string | null; missingDocuments: DocumentKind[] };
export type SummaryInput = {
  athlete: { name: string | null; birthDate: string | null; contactName: string | null; phone: string | null; email: string | null; status: AthleteStatus; notes: string | null };
  groups: { season: string; group: string; main: boolean }[];
  acs: { season: string; state: AcsState }[];
  registrations: SummaryRegistration[];
  history: { at: string; actor: string; text: string; subject: string }[];
  generatedAt: Date;
  generatedBy: string;
};

const P = PERSONAL_DATA_COPY.pdf;
const row = (label: string, value: string | null | undefined): SummaryRow => ({ label, value: value ?? '' });
const orNone = (rows: SummaryRow[]): SummaryRow[] => (rows.length ? rows : [row('', P.none)]);
const single = (title: string, rows: SummaryRow[]): SummarySection => ({ title, blocks: [{ heading: null, rows: orNone(rows) }] });
const isoText = (v: unknown): string => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : '');

function athleteSection(a: SummaryInput['athlete']): SummarySection {
  return single(P.athlete, [
    row(ATHLETE_FIELD_LABELS.name, a.name), row(ATHLETE_FIELD_LABELS.birthDate, birthDateForPicker(a.birthDate)),
    row(ATHLETE_FIELD_LABELS.contactName, a.contactName), row(ATHLETE_FIELD_LABELS.phone, a.phone), row(ATHLETE_FIELD_LABELS.email, a.email),
    row(P.status, STATUS_WORDS[a.status]), row(P.notes, a.notes),
  ]);
}

function registrationBlock(r: SummaryRegistration): SummaryBlock {
  const submitted = isoText(r.record.submittedAt);
  return {
    heading: `${P.registration} ${r.number}`.trim(),
    rows: [
      row(P.season, r.seasonLabel), row(P.school, r.sectionName), row(P.status, typeof r.record.status === 'string' ? r.record.status : ''),
      ...dateTabRows(r.record).map((x) => row(x.label, x.value)),
      ...abonamentTabRows(r.record).map((x) => row(x.label, x.value)),
      row(P.submittedAt, submitted ? formatEmailSentAt(submitted) : ''),
      ...r.missingDocuments.map((kind) => row(DOCUMENT_LABELS[kind], PERSONAL_DATA_COPY.missingDocument)),
    ],
  };
}

function registrationsSection(list: SummaryRegistration[]): SummarySection {
  return list.length ? { title: P.registrations, blocks: list.map(registrationBlock) } : single(P.registrations, []);
}

const historyRow = (l: SummaryInput['history'][number]): SummaryRow =>
  row([historyWhen(l.at), l.actor].filter(Boolean).join(', '), l.subject ? `${P.registration} ${l.subject}: ${l.text}` : l.text);

export function buildSummaryModel(input: SummaryInput): SummaryModel {
  return {
    title: P.title,
    name: input.athlete.name ?? '',
    sections: [
      athleteSection(input.athlete),
      single(P.groups, input.groups.map((g) => row(g.season, g.main ? `${g.group}, ${P.mainGroup}` : g.group))),
      single(P.acs, input.acs.map((a) => row(a.season, ACS_WORDS[a.state]))),
      registrationsSection(input.registrations),
      single(P.history, input.history.map(historyRow)),
    ],
    footer: P.generated(formatEmailSentAt(input.generatedAt.toISOString()), input.generatedBy),
  };
}
```

- [ ] **Step 4: `summary-pdf.ts`**

```ts
import PDFDocument from 'pdfkit';
import { drawLabel, drawParagraph, hLine, paragraphHeight, type ParagraphStyle } from '../documents/pdf/draw';
import { drawFooter, footerTop } from '../documents/pdf/frame';
import { COLOR, CONTENT_WIDTH, FONT, MARGIN, PAGE, px, registerFonts } from '../documents/pdf/style';
import { b, t } from '../documents/runs';
import type { SummaryBlock, SummaryModel, SummaryRow, SummarySection } from './summary-model';

type Doc = PDFKit.PDFDocument;
type Cursor = { doc: Doc; y: number };

const TEXT: ParagraphStyle = { size: px(8.5), lineHeight: 1.45, align: 'left' };
const LABEL_WIDTH = px(150);
const GAP = px(12);
const VALUE_WIDTH = CONTENT_WIDTH - LABEL_WIDTH - GAP;
const ROW_GAP = px(3);

/** CLUBUL SPORTIV / EDUSPORT and the navy rule, placed as on the Acord (documents/pdf/frame.ts); returns the y below. */
function drawBrand(doc: Doc): number {
  const top = MARGIN.top;
  drawLabel(doc, 'CLUBUL SPORTIV', MARGIN.side, top, { font: FONT.bold, size: px(7.5), color: COLOR.navy, spacing: px(7.5 * 0.34) });
  drawLabel(doc, 'EDUSPORT', MARGIN.side, top + px(13.5), { font: FONT.wordmark, size: px(20), color: COLOR.navy, spacing: px(0.8) });
  const rule = top + px(44.5);
  hLine(doc, MARGIN.side, PAGE.width - MARGIN.side, rule, px(2), COLOR.navy);
  return rule + px(14);
}

function startPage(doc: Doc): Cursor {
  drawFooter(doc);
  return { doc, y: drawBrand(doc) };
}

/** `height` must fit above the footer; otherwise a new page with the same frame. */
function room(c: Cursor, height: number): Cursor {
  if (c.y + height <= footerTop(c.doc)) return c;
  c.doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });
  return startPage(c.doc);
}

const rowHeight = (doc: Doc, r: SummaryRow): number =>
  Math.max(paragraphHeight(doc, [b(r.label)], LABEL_WIDTH, TEXT), paragraphHeight(doc, [t(r.value)], VALUE_WIDTH, TEXT)) + ROW_GAP;

function drawRow(c: Cursor, r: SummaryRow): Cursor {
  const height = rowHeight(c.doc, r);
  const at = room(c, height);
  drawParagraph(at.doc, [b(r.label)], { x: MARGIN.side, y: at.y, width: LABEL_WIDTH }, TEXT);
  drawParagraph(at.doc, [t(r.value)], { x: MARGIN.side + LABEL_WIDTH + GAP, y: at.y, width: VALUE_WIDTH }, TEXT);
  return { ...at, y: at.y + height };
}

/** A heading is never left alone at the foot of a page: it needs room for one more row. */
function drawHeading(c: Cursor, text: string, size: number): Cursor {
  const height = size * 1.4 + px(6);
  const at = room(c, height + px(16));
  drawLabel(at.doc, text, MARGIN.side, at.y + px(4), { font: FONT.bold, size, color: COLOR.navy });
  return { ...at, y: at.y + height };
}

function drawBlock(c: Cursor, block: SummaryBlock): Cursor {
  let at = block.heading ? drawHeading(c, block.heading, px(9)) : c;
  for (const r of block.rows) at = drawRow(at, r);
  return at;
}

function drawSection(c: Cursor, section: SummarySection): Cursor {
  let at = drawHeading(c, section.title, px(11));
  for (const block of section.blocks) at = drawBlock(at, block);
  return { ...at, y: at.y + px(6) };
}

function drawSummary(doc: Doc, model: SummaryModel): void {
  let c = drawHeading(startPage(doc), `${model.title}: ${model.name}`, px(13.5));
  for (const section of model.sections) c = drawSection(c, section);
  drawRow(c, { label: '', value: model.footer });
}

/** "rezumat.pdf" (spec 3): the Acord's fonts, wordmark and association footer, on as many A4 pages as needed. */
export function renderSummaryPdf(model: SummaryModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: 0, info: { Title: `${model.title}: ${model.name}`, Author: 'Asociația Clubul Sportiv EduSport' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      registerFonts(doc);
      drawSummary(doc, model);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
```

- [ ] **Step 5: Run the tests and the checks**

Run: `npx vitest run src/club/personal-data/__tests__/summary.test.ts`, `npx vitest run`, `npx tsc --noEmit`
Expected: PASS, PASS, zero errors. If pdf.js joins a row's label and value without a space (`Telefon0799`), compare against the `text` with `.replace(/\s+/g, ' ')` as written; do not change the layout to please the extractor.

- [ ] **Step 6: Commit**

```bash
git add src/club/personal-data/summary-model.ts src/club/personal-data/summary-pdf.ts src/club/personal-data/__tests__/summary.test.ts
git commit -m "feat(personal-data): export summary model and PDF"
```

---

### Task 5: Store methods (Strapi and fake, with a parity test)

**Files:**
- Modify: `src/club/athletes/store.ts` (`AthleteRow`, `AthleteWrite`, `ClubEmailJob`, `ClubStore`)
- Modify: `src/club/athletes/strapi-store.ts` (`toAthleteRow`, new `personalDataStore`, `strapiClubStore`)
- Modify: `src/club/athletes/__tests__/fake-store.ts` (`FakeState`, `EMPTY`, `athleteRow`, `createAthlete`, new `fakePersonalData`, `fakeClubStore`)
- Modify: `src/club/athletes/__tests__/strapi-store.test.ts` (the `toAthleteRow` expectation)
- Test: `src/club/athletes/__tests__/store-3c.test.ts`

**Interfaces:**
- Consumes: Task 3 `RegistrationScrub`, `scrubbedJobStatus`; Task 2 `PersonalDataSettings`.
- Produces (every later server task uses these exact names):
  - `AthleteRow` gains `createdAt: string; anonymizedAt: string | null` (the fake's default `createdAt` is `'2026-10-01T10:00:00.000Z'`).
  - `AthleteWrite` gains `firstName: null; lastName: null; anonymizedAt: string | null` (all optional, like the rest); `AthleteScrub` (Task 3) is assignable to it.
  - `type ClubEmailJob = { id: string; registrationId: string | null; recipient: string | null; subject: string | null; status: string }` (fake state only; the Strapi store never returns it).
  - `ClubStore` methods:
    - `registrationRecords(athleteId: string): Promise<Record<string, unknown>[]>` (raw rows, every attribute, linked to the athlete)
    - `anonymizedRegistrationIds(): Promise<string[]>`
    - `setHistoryChanges(seq: number, changes: Record<string, unknown>): Promise<void>`
    - `scrubRegistration(id: string, data: RegistrationScrub): Promise<void>`
    - `scrubEmailJobs(registrationIds: string[]): Promise<void>`
    - `personalDataSettings(): Promise<unknown>`
    - `savePersonalDataSettings(value: PersonalDataSettings): Promise<void>`
  - Fake: `FakeState` gains `registrationRecords: Record<string, Record<string, unknown>>`, `emailJobs: ClubEmailJob[]`, `settings: unknown`.

- [ ] **Step 1: Write the failing test**

`src/club/athletes/__tests__/store-3c.test.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { registrationScrub } from '../../personal-data/anonymize-plan';
import { strapiClubStore, toAthleteRow } from '../strapi-store';
import { athleteRow, fakeClubStore, registrationRow } from './fake-store';

type Call = [string, string, unknown];

/** Records db.query and documents calls; `rows` answers findMany / findFirst per uid. */
function recordingStrapi(calls: Call[], rows: Record<string, unknown[]> = {}): Core.Strapi {
  const query = (uid: string) => ({
    findMany: async (args: unknown) => { calls.push([uid, 'findMany', args]); return rows[uid] ?? []; },
    update: async (args: unknown) => { calls.push([uid, 'update', args]); return {}; },
  });
  const documents = (uid: string) => ({
    findFirst: async (args: unknown) => { calls.push([uid, 'findFirst', args]); return (rows[uid] ?? [])[0] ?? null; },
    update: async (args: unknown) => { calls.push([uid, 'update', args]); return {}; },
    create: async (args: unknown) => { calls.push([uid, 'create', args]); return {}; },
  });
  return { db: { query }, documents } as unknown as Core.Strapi;
}

const REG = 'api::registration-submission.registration-submission';
const JOB = 'api::email-job.email-job';
const HISTORY = 'api::history-entry.history-entry';
const SETTINGS = 'api::site-settings.site-settings';

describe('store parity (3C spec 8)', () => {
  it('the fake and the Strapi store expose the same methods', () => {
    const strapiKeys = Object.keys(strapiClubStore({} as Core.Strapi)).sort();
    expect(Object.keys(fakeClubStore().store).sort()).toEqual(strapiKeys);
  });
});

describe('Strapi store, 3C writes', () => {
  it('reads createdAt and anonymizedAt of an athlete', () => {
    const row = toAthleteRow({ documentId: 'a1', status: 'anonimizat', createdAt: new Date('2020-01-02T03:04:05.000Z'), anonymizedAt: '2026-10-27T09:00:00.000Z' });
    expect(row).toMatchObject({ status: 'anonimizat', createdAt: '2020-01-02T03:04:05.000Z', anonymizedAt: '2026-10-27T09:00:00.000Z' });
  });

  it('scrubs a registration with one db update (required fields too, lifecycles still run)', async () => {
    const calls: Call[] = [];
    const data = registrationScrub(null);
    await strapiClubStore(recordingStrapi(calls)).scrubRegistration('r1', data);
    expect(calls).toEqual([[REG, 'update', { where: { documentId: 'r1' }, data }]]);
  });

  it('replaces one history row by its id', async () => {
    const calls: Call[] = [];
    await strapiClubStore(recordingStrapi(calls)).setHistoryChanges(42, { name: null });
    expect(calls).toEqual([[HISTORY, 'update', { where: { id: 42 }, data: { changes: { name: null } } }]]);
  });

  it('clears the e-mail jobs of the registrations; a queued job is cancelled', async () => {
    const calls: Call[] = [];
    const strapi = recordingStrapi(calls, { [JOB]: [{ id: 7, status: 'queued' }, { id: 8, status: 'sent' }] });
    await strapiClubStore(strapi).scrubEmailJobs(['r1', 'r2']);
    expect(calls).toEqual([
      [JOB, 'findMany', { where: { registration: { documentId: { $in: ['r1', 'r2'] } } }, select: ['id', 'status'], limit: 100000 }],
      [JOB, 'update', { where: { id: 7 }, data: { recipient: null, subject: null, status: 'cancelled' } }],
      [JOB, 'update', { where: { id: 8 }, data: { recipient: null, subject: null, status: 'sent' } }],
    ]);
    const none: Call[] = [];
    await strapiClubStore(recordingStrapi(none)).scrubEmailJobs([]);
    expect(none).toEqual([]);
  });

  it('lists the registrations of anonymized athletes and the raw rows of one athlete', async () => {
    const calls: Call[] = [];
    const strapi = recordingStrapi(calls, { [REG]: [{ documentId: 'r1', childName: 'Anonimizat' }] });
    expect(await strapiClubStore(strapi).anonymizedRegistrationIds()).toEqual(['r1']);
    expect(await strapiClubStore(strapi).registrationRecords('a1')).toEqual([{ documentId: 'r1', childName: 'Anonimizat' }]);
    expect(calls.map((c) => c[2])).toEqual([
      { where: { athlete: { status: 'anonimizat' } }, select: ['documentId'], limit: 100000 },
      { where: { athlete: { documentId: 'a1' } }, orderBy: { id: 'asc' }, limit: 100000 },
    ]);
  });

  it('reads and saves site-settings.personalData', async () => {
    const calls: Call[] = [];
    const strapi = recordingStrapi(calls, { [SETTINGS]: [{ documentId: 'set1', personalData: { retentionYears: 6 } }] });
    expect(await strapiClubStore(strapi).personalDataSettings()).toEqual({ retentionYears: 6 });
    await strapiClubStore(strapi).savePersonalDataSettings({ retentionYears: 6, reviewHiddenUntilSeason: '2026-2027' });
    expect(calls.at(-1)).toEqual([SETTINGS, 'update', { documentId: 'set1', data: { personalData: { retentionYears: 6, reviewHiddenUntilSeason: '2026-2027' } } }]);
    const empty: Call[] = [];
    await strapiClubStore(recordingStrapi(empty)).savePersonalDataSettings({ retentionYears: 5, reviewHiddenUntilSeason: null });
    expect(empty.at(-1)).toEqual([SETTINGS, 'create', { data: { personalData: { retentionYears: 5, reviewHiddenUntilSeason: null } } }]);
  });
});

describe('fake store, same behaviour', () => {
  it('scrubs a registration: the row reads like the Strapi row would, the raw record holds nulls', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', status: 'anonimizat' })],
      registrations: [registrationRow({ id: 'r1', athleteId: 'a1', lastSeason: 'Începători' })],
      registrationRecords: { r1: { shirtSize: 'S', gdprConsent: true } },
    });
    await fake.store.scrubRegistration('r1', registrationScrub(null));
    expect(await fake.store.registration('r1')).toMatchObject({ childName: 'Anonimizat', parentName: '', phone: '', email: '', childBirthDate: '', lastSeason: null, number: '2026-0142' });
    expect((await fake.store.registrationRecords('a1'))[0]).toMatchObject({ documentId: 'r1', shirtSize: null, parentName: null, gdprConsent: true, registrationNumber: '2026-0142' });
    expect(await fake.store.anonymizedRegistrationIds()).toEqual(['r1']);
  });

  it('e-mail jobs, history rows and settings', async () => {
    const fake = fakeClubStore({
      emailJobs: [{ id: 'j1', registrationId: 'r1', recipient: 'a@x.ro', subject: 'S', status: 'queued' }, { id: 'j2', registrationId: 'r9', recipient: 'b@x.ro', subject: 'T', status: 'queued' }],
      history: [{ seq: 1, subjectType: 'athlete', subjectId: 'a1', action: 'updated', changes: { name: 'X' }, actor: 'ana@example.com', at: '2026-10-01T10:00:00.000Z' }],
    });
    await fake.store.scrubEmailJobs(['r1']);
    expect(fake.state.emailJobs).toEqual([
      { id: 'j1', registrationId: 'r1', recipient: null, subject: null, status: 'cancelled' },
      { id: 'j2', registrationId: 'r9', recipient: 'b@x.ro', subject: 'T', status: 'queued' },
    ]);
    await fake.store.setHistoryChanges(1, { name: null });
    expect(fake.state.history[0].changes).toEqual({ name: null });
    expect(await fake.store.personalDataSettings()).toBeNull();
    await fake.store.savePersonalDataSettings({ retentionYears: 7, reviewHiddenUntilSeason: null });
    expect(await fake.store.personalDataSettings()).toEqual({ retentionYears: 7, reviewHiddenUntilSeason: null });
  });

  it('a created athlete carries its creation time', async () => {
    const fake = fakeClubStore();
    const id = await fake.store.createAthlete({ name: 'Nou' });
    const created = fake.state.athletes.find((a) => a.id === id);
    expect(created?.createdAt).toBe(created?.updatedAt);
    expect(created?.anonymizedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/athletes/__tests__/store-3c.test.ts`
Expected: FAIL (`scrubRegistration is not a function`, type errors on `registrationRecords`).

- [ ] **Step 3: `store.ts`**

Add the imports at the top:

```ts
import type { PersonalDataSettings } from '../personal-data/settings';
import type { RegistrationScrub } from '../personal-data/anonymize-plan';
```

Replace the `AthleteRow` line:

```ts
export type AthleteRow = AthleteValues & {
  id: string; status: AthleteStatus; dataIncomplete: boolean; profileId: string | null; notes: string | null; updatedAt: string; createdAt: string; anonymizedAt: string | null;
};
```

Replace the `AthleteWrite` line:

```ts
export type AthleteWrite = Partial<AthleteValues & {
  status: AthleteStatus; dataIncomplete: boolean; profileId: string | null; notes: string | null; firstName: null; lastName: null; anonymizedAt: string | null;
}>;
/** One e-mail job as the 3C tests see it (fake state); the services only call `scrubEmailJobs`. */
export type ClubEmailJob = { id: string; registrationId: string | null; recipient: string | null; subject: string | null; status: string };
```

Add to `interface ClubStore`, after `record(entry: HistoryInput): Promise<void>;`:

```ts
  /** Raw registration rows of one athlete (every attribute), for the export summary (3C spec 3). */
  registrationRecords(athleteId: string): Promise<Record<string, unknown>[]>;
  /** Registrations linked to an anonymized athlete: the startup sweep of their PDF folders (3C spec 4). */
  anonymizedRegistrationIds(): Promise<string[]>;
  /** Replaces one history row's `changes` (3C scrubbing); `seq` is HistoryRow.seq. */
  setHistoryChanges(seq: number, changes: Record<string, unknown>): Promise<void>;
  /** Writes the 3C scrub on a registration, required form fields included; lifecycles (Sheet row) still run. */
  scrubRegistration(id: string, data: RegistrationScrub): Promise<void>;
  /** E-mail jobs of these registrations: recipient and subject cleared, a queued job cancelled. */
  scrubEmailJobs(registrationIds: string[]): Promise<void>;
  /** site-settings.personalData as stored (read it with `readPersonalDataSettings`). */
  personalDataSettings(): Promise<unknown>;
  savePersonalDataSettings(value: PersonalDataSettings): Promise<void>;
```

- [ ] **Step 4: `strapi-store.ts`**

Add the uids after `const HISTORY = ...`:

```ts
const JOB = 'api::email-job.email-job' as const;
const SETTINGS = 'api::site-settings.site-settings' as const;
```

Add the import `import { scrubbedJobStatus } from '../personal-data/anonymize-plan';` and replace `toAthleteRow`:

```ts
export function toAthleteRow(r: Raw): AthleteRow {
  return {
    id: text(r.documentId), name: str(r.name), birthDate: str(r.birthDate), contactName: str(r.contactName), phone: str(r.phone), email: str(r.email),
    status: oneOf(ATHLETE_STATUSES, r.status, 'activ'), dataIncomplete: r.dataIncomplete === true, profileId: linkId(r.publicProfile), notes: str(r.notes),
    updatedAt: iso(r.updatedAt) ?? '', createdAt: iso(r.createdAt) ?? '', anonymizedAt: iso(r.anonymizedAt),
  };
}
```

Add, before `strapiClubStore`:

```ts
/**
 * 3C reads and writes. Registration and e-mail job scrubs go through `db.query`: the document service refuses null on a
 * `required` attribute, the query engine does not, and the database lifecycles (the Înscrieri Sheet row) still run.
 */
function personalDataStore(strapi: Core.Strapi): Pick<ClubStore, 'registrationRecords' | 'anonymizedRegistrationIds' | 'setHistoryChanges' | 'scrubRegistration' | 'scrubEmailJobs'> {
  const query = (uid: typeof REGISTRATION | typeof JOB | typeof HISTORY) => strapi.db.query(uid);
  return {
    registrationRecords: async (athleteId) => raws(await query(REGISTRATION).findMany({ where: { athlete: { documentId: athleteId } }, orderBy: { id: 'asc' }, limit: MAX })),
    anonymizedRegistrationIds: async () =>
      raws(await query(REGISTRATION).findMany({ where: { athlete: { status: 'anonimizat' } }, select: ['documentId'], limit: MAX })).map((r) => text(r.documentId)),
    setHistoryChanges: async (seq, changes) => {
      await query(HISTORY).update({ where: { id: seq }, data: { changes } });
    },
    scrubRegistration: async (id, data) => {
      await query(REGISTRATION).update({ where: { documentId: id }, data });
    },
    scrubEmailJobs: async (registrationIds) => {
      if (!registrationIds.length) return;
      const jobs = raws(await query(JOB).findMany({ where: { registration: { documentId: { $in: registrationIds } } }, select: ['id', 'status'], limit: MAX }));
      for (const j of jobs) await query(JOB).update({ where: { id: j.id }, data: { recipient: null, subject: null, status: scrubbedJobStatus(text(j.status)) } });
    },
  };
}

function settingsStore(strapi: Core.Strapi): Pick<ClubStore, 'personalDataSettings' | 'savePersonalDataSettings'> {
  const settings = () => strapi.documents(SETTINGS);
  return {
    personalDataSettings: async () => ((await settings().findFirst({})) as Raw | null)?.personalData ?? null,
    savePersonalDataSettings: async (value) => {
      const current = await settings().findFirst({});
      if (current) await settings().update({ documentId: current.documentId, data: { personalData: value } });
      else await settings().create({ data: { personalData: value } });
    },
  };
}
```

and spread both into `strapiClubStore`, after `...profileWrites(strapi),`:

```ts
    ...personalDataStore(strapi),
    ...settingsStore(strapi),
```

If `tsc` refuses `data` or `personalData` on the typed query engine or document service, keep the values as written and type the argument object with a local `type JsonObject = Record<string, unknown>` cast at that one call (`data: data as unknown as JsonObject`); never `any`.

In `src/club/athletes/__tests__/strapi-store.test.ts`, the "reads an athlete with its profile link" case: add `createdAt: new Date('2026-09-01T08:00:00.000Z')` to the input and `createdAt: '2026-09-01T08:00:00.000Z', anonymizedAt: null` to the expected object.

- [ ] **Step 5: `fake-store.ts`**

Imports: add `ClubEmailJob` to the `../store` type import and add

```ts
import { scrubbedJobStatus } from '../../personal-data/anonymize-plan';
```

`FakeState`:

```ts
export type FakeState = {
  athletes: AthleteRow[]; registrations: RegistrationRow[]; seasons: SeasonRow[]; sections: SectionRow[]; groups: GroupRow[];
  memberships: MembershipRow[]; acs: AcsRow[]; duplicates: DuplicateRow[]; profiles: ProfileRow[]; history: HistoryRow[];
  removedParticipations: string[]; locks: string[]; admins: Record<string, string>;
  /** Extra raw attributes per registration id (shirtSize, consents, ...), merged over the row by `registrationRecords`. */
  registrationRecords: Record<string, Record<string, unknown>>; emailJobs: ClubEmailJob[]; settings: unknown;
};
```

`athleteRow` base (add the two fields at the end):

```ts
  const base: AthleteRow = {
    id: over.id, name: null, birthDate: null, contactName: null, phone: null, email: null, status: 'activ', dataIncomplete: false, profileId: null, notes: null,
    updatedAt: '2026-10-01T10:00:00.000Z', createdAt: '2026-10-01T10:00:00.000Z', anonymizedAt: null,
  };
```

`createAthlete` in `fakeAthleteWrites`:

```ts
    createAthlete: async (data) => {
      const id = next('ath');
      const at = tick();
      s.athletes.push(athleteRow({ ...data, id, updatedAt: at, createdAt: at }));
      return id;
    },
```

`EMPTY`:

```ts
const EMPTY: FakeState = {
  athletes: [], registrations: [], seasons: SEASONS, sections: SECTIONS, groups: GROUPS, memberships: [], acs: [], duplicates: [],
  profiles: [], history: [], removedParticipations: [], locks: [], admins: {}, registrationRecords: {}, emailJobs: [], settings: null,
};
```

New functions above `withFailures`:

```ts
/** The raw attributes the Strapi store would read for a registration row. */
const rawOf = (r: RegistrationRow): Record<string, unknown> => ({
  documentId: r.id, registrationNumber: r.number, childName: r.childName, childBirthDate: r.childBirthDate, parentName: r.parentName, phone: r.phone,
  email: r.email, status: r.status, archived: r.archived, season: r.season, membershipAnswer: r.membershipAnswer, lastSeason: r.lastSeason,
  subscriptionChoice: r.subscriptionChoice, submittedAt: r.submittedAt,
});

/** After a scrub the Strapi store reads null text fields as '' (toRegistrationRow), so the fake row does the same. */
function scrubRow(row: RegistrationRow, data: RegistrationScrub): void {
  Object.assign(row, { childName: data.childName, childBirthDate: '', parentName: '', phone: '', email: '', childBirthDateParsed: null, lastSeason: null, confirmation: data.confirmation });
}

type PersonalData = 'registrationRecords' | 'anonymizedRegistrationIds' | 'setHistoryChanges' | 'scrubRegistration' | 'scrubEmailJobs' | 'personalDataSettings' | 'savePersonalDataSettings';

function fakePersonalData(s: FakeState): Pick<ClubStore, PersonalData> {
  return {
    registrationRecords: async (athleteId) =>
      structuredClone(s.registrations.filter((r) => r.athleteId === athleteId).map((r) => ({ ...rawOf(r), ...s.registrationRecords[r.id] }))),
    anonymizedRegistrationIds: async () => {
      const anonymized = new Set(s.athletes.filter((a) => a.status === 'anonimizat').map((a) => a.id));
      return s.registrations.filter((r) => r.athleteId !== null && anonymized.has(r.athleteId)).map((r) => r.id);
    },
    setHistoryChanges: async (seq, changes) => {
      const row = s.history.find((h) => h.seq === seq);
      if (!row) throw new Error(`fake: no history row ${seq}`);
      row.changes = structuredClone(changes);
    },
    scrubRegistration: async (id, data) => {
      scrubRow(must(s.registrations, id), data);
      s.registrationRecords[id] = { ...s.registrationRecords[id], ...structuredClone(data) };
    },
    scrubEmailJobs: async (ids) => {
      for (const j of s.emailJobs) if (j.registrationId && ids.includes(j.registrationId)) Object.assign(j, { recipient: null, subject: null, status: scrubbedJobStatus(j.status) });
    },
    personalDataSettings: async () => structuredClone(s.settings),
    savePersonalDataSettings: async (value) => {
      s.settings = structuredClone(value);
    },
  };
}
```

(add `RegistrationScrub` to the imports: `import { scrubbedJobStatus, type RegistrationScrub } from '../../personal-data/anonymize-plan';`)

In `fakeClubStore`, extend the spread line:

```ts
    ...fakeReads(state), ...fakeAthleteWrites(state, next, tick), ...fakeRowWrites(state, next), ...fakeProfileWrites(state, next), ...fakeHistory(state, tick),
    ...fakePersonalData(state),
```

- [ ] **Step 6: Run the tests and the checks**

Run: `npx vitest run src/club/athletes/__tests__/store-3c.test.ts src/club/athletes/__tests__/strapi-store.test.ts`, `npx vitest run`, `npx tsc --noEmit`
Expected: PASS, PASS (no other test builds an `AthleteRow` by hand: only `athleteRow()` and `toAthleteRow`), zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/club/athletes/store.ts src/club/athletes/strapi-store.ts src/club/athletes/__tests__/fake-store.ts src/club/athletes/__tests__/strapi-store.test.ts src/club/athletes/__tests__/store-3c.test.ts
git commit -m "feat(personal-data): store reads and writes for export and anonymization"
```

---

### Task 6: Anonymize service (single and bulk) and the folder sweep

**Files:**
- Create: `src/club/personal-data/anonymize-service.ts`, `src/club/personal-data/sweep.ts`
- Test: `src/club/personal-data/__tests__/anonymize-service.test.ts`

**Interfaces:**
- Consumes: Task 5 store methods (`scrubRegistration`, `scrubEmailJobs`, `setHistoryChanges`, `anonymizedRegistrationIds`), existing `ClubStore` (`athlete`, `registrations`, `duplicates`, `deleteDuplicate`, `deleteProfile`, `updateAthlete`, `history`, `record`, `transaction`); `lockAthletesWithRegistrations(store, ids)` (`src/club/athletes/locks.ts`, polish); Task 3 `athleteScrub`, `registrationScrub`, `scrubChanges`, `BulkAnonymizeResult`; `guarded`, `refuse` (`admin-result.ts`), `refreshAllMatches`, `safely` (`athletes/matches.ts`), `ADMIN_ERRORS`, `HISTORY_ACTIONS`, `SUBJECT`.
- Produces:
  - `type RemoveFiles = (registrationId: string) => Promise<void>`
  - `type AnonymizeContext = ServiceContext & { removeFiles: RemoveFiles; now: () => Date }`
  - `anonymizeAthlete(ctx: AnonymizeContext, id: string): Promise<AdminResult<{ documentId: string }>>` (404 unknown, 409 already anonymized, 500 shared text on failure)
  - `anonymizeAthletes(ctx: AnonymizeContext, ids: string[]): Promise<AdminResult<BulkAnonymizeResult>>` (each athlete in its own transaction; 404/409 count as `skipped`, 500 as `failed`)
  - `sweepAnonymizedFolders(store: ClubStore, removeFiles: RemoveFiles, log: (message: string) => void): Promise<number>`

Order inside the transaction (spec 4 and the lock rule): lock registrations then the athlete (`lockAthletesWithRegistrations(store, [id])`), read, 404/409, scrub Istoric (athlete, its registrations, the paired records' "Nu e același copil" lines naming the child), e-mail jobs, registrations, delete the duplicate pairs, delete the public profile (existing `deleteProfile`: draft and published rows, competition participations; no `previousSlugs` written), write the athlete scrub, record "Date anonimizate". After the commit: delete each registration's PDF folder (a failure is logged; the startup sweep retries), then refresh matches through `safely`.

- [ ] **Step 1: Write the failing test**

`src/club/personal-data/__tests__/anonymize-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ConfirmationRecord } from '../../confirm/plan';
import { athleteRow, fakeClubStore, registrationRow, type FakeState } from '../../athletes/__tests__/fake-store';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { HISTORY_ACTIONS, SUBJECT } from '../../history-text';
import { REGISTRATION_NULLED_KEYS } from '../anonymize-plan';
import { anonymizeAthlete, anonymizeAthletes, type AnonymizeContext } from '../anonymize-service';
import { sweepAnonymizedFolders } from '../sweep';

const NOW = new Date('2026-10-27T09:00:00.000Z');
const AT = '2026-10-20T10:00:00.000Z';
const CONFIRMATION: ConfirmationRecord = {
  athleteId: 'a1', createdAthlete: false, previousStatus: 'Contactat', athleteStatusBefore: 'activ', fieldsBefore: { phone: '0722000000', email: 'old@example.com' },
  fieldsAfter: { phone: '0799123456' }, membershipId: 'gm1', demotedMainId: null, promotedMainId: null, acs: null, seasonId: 's26', at: AT,
};

function seed(): Partial<FakeState> {
  return {
    athletes: [
      athleteRow({ id: 'a1', name: 'Ilinca Zamfirescu', birthDate: '2013-04-27', contactName: 'Dana Zamfirescu', phone: '0799123456', email: 'dana@example.com', notes: 'Alergie', profileId: 'sp1' }),
      athleteRow({ id: 'a2', name: 'Irina Pereche', birthDate: '2016-03-14' }),
    ],
    profiles: [{ id: 'sp1', name: 'Ilinca Zamfirescu', slug: 'ilinca-zamfirescu', previousSlugs: [], showPublicPage: true, published: true }],
    registrations: [
      registrationRow({ id: 'r1', childName: 'Ilinca Zamfirescu', parentName: 'Dana Zamfirescu', phone: '0799123456', email: 'dana@example.com', childBirthDate: '27.04.2013', status: 'Confirmat', athleteId: 'a1', lastSeason: 'Începători', confirmation: CONFIRMATION }),
      registrationRow({ id: 'r2', number: '2026-0150', childName: 'Irina Pereche', status: 'Confirmat', athleteId: 'a2', childBirthDateParsed: '2016-03-14' }),
      registrationRow({ id: 'r3', number: '2026-0151', childName: 'Ilinca Zamfirescu', matchAthleteId: 'a1', matchLevel: 'sigur' }),
    ],
    registrationRecords: { r1: { shirtSize: 'S', childHeight: 142, priorExperience: 'Nu', expectations: 'Să sară', internalNote: 'Sună seara', extra: { q: 'x' }, submissionKey: 'k1', gdprConsent: true } },
    memberships: [{ id: 'gm1', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: '2026-10-05' }],
    acs: [{ id: 'acs1', athleteId: 'a1', seasonId: 's26', state: 'da' }],
    duplicates: [{ id: 'd1', firstId: 'a1', secondId: 'a2', dismissed: true }],
    history: [
      { seq: 1, subjectType: SUBJECT.athlete, subjectId: 'a1', action: HISTORY_ACTIONS.updated, changes: { fields: { phone: { from: '0722000000', to: '0799123456' } } }, actor: 'ana@example.com', at: AT },
      { seq: 2, subjectType: SUBJECT.registration, subjectId: 'r1', action: 'email-resent', changes: { recipient: 'dana@example.com', documents: ['Ilinca-Zamfirescu_Acord_2026-2027.pdf'] }, actor: 'ana@example.com', at: AT },
      { seq: 3, subjectType: SUBJECT.athlete, subjectId: 'a2', action: HISTORY_ACTIONS.duplicateDismissed, changes: { name: 'Ilinca Zamfirescu' }, actor: 'ana@example.com', at: AT },
      { seq: 4, subjectType: SUBJECT.athlete, subjectId: 'a2', action: HISTORY_ACTIONS.updated, changes: { fields: { phone: { from: '1', to: '2' } } }, actor: 'ana@example.com', at: AT },
      { seq: 5, subjectType: SUBJECT.registration, subjectId: 'r2', action: HISTORY_ACTIONS.updated, changes: { fields: { email: { from: 'x@y.ro', to: 'z@y.ro' } } }, actor: 'ana@example.com', at: AT },
    ],
    emailJobs: [
      { id: 'j1', registrationId: 'r1', recipient: 'dana@example.com', subject: 'Înscriere Ilinca Zamfirescu', status: 'sent' },
      { id: 'j2', registrationId: 'r1', recipient: 'dana@example.com', subject: 'Înscriere Ilinca Zamfirescu', status: 'queued' },
      { id: 'j3', registrationId: 'r1', recipient: 'dana@example.com', subject: 'Înscriere Ilinca Zamfirescu', status: 'failed' },
      { id: 'j4', registrationId: 'r2', recipient: 'irina@example.com', subject: 'Înscriere Irina Pereche', status: 'queued' },
    ],
  };
}

function setup(state: Partial<FakeState> = seed()) {
  const fake = fakeClubStore(state);
  const removed: string[] = [];
  const logs: string[] = [];
  const ctx: AnonymizeContext = {
    store: fake.store, actor: 'super@example.com', today: { year: 2026, month: 10, day: 27 }, log: (m) => logs.push(m),
    removeFiles: async (id) => { removed.push(id); }, now: () => NOW,
  };
  return { fake, ctx, removed, logs };
}

describe('anonymize one athlete (spec 4)', () => {
  it('empties the athlete and keeps groups, A.C.S. and counts', async () => {
    const { fake, ctx } = setup();
    expect(await anonymizeAthlete(ctx, 'a1')).toEqual({ ok: true, data: { documentId: 'a1' } });
    expect(fake.state.athletes.find((a) => a.id === 'a1')).toMatchObject({
      name: 'Sportiv anonimizat', birthDate: null, contactName: null, phone: null, email: null, notes: null,
      status: 'anonimizat', dataIncomplete: false, profileId: null, anonymizedAt: NOW.toISOString(),
    });
    expect(fake.state.memberships).toHaveLength(1);
    expect(fake.state.acs).toHaveLength(1);
    expect(fake.state.registrations).toHaveLength(3);
  });

  it('scrubs its registrations and nothing of another athlete', async () => {
    const { fake, ctx } = setup();
    const other = structuredClone(fake.state.registrations.find((r) => r.id === 'r2'));
    await anonymizeAthlete(ctx, 'a1');
    expect(fake.state.registrations.find((r) => r.id === 'r1')).toMatchObject({
      childName: 'Anonimizat', parentName: '', phone: '', email: '', childBirthDate: '', lastSeason: null, number: '2026-0142', status: 'Confirmat', athleteId: 'a1', season: '2026-2027',
    });
    const raw = (await fake.store.registrationRecords('a1'))[0];
    for (const key of REGISTRATION_NULLED_KEYS) expect(raw[key], key).toBeNull();
    expect(raw.gdprConsent).toBe(true);
    const confirmation = fake.state.registrations.find((r) => r.id === 'r1')?.confirmation;
    expect(confirmation).toMatchObject({ fieldsBefore: { phone: null, email: null }, fieldsAfter: { phone: null }, membershipId: 'gm1' });
    expect(fake.state.registrations.find((r) => r.id === 'r2')).toEqual(other);
  });

  it('blanks old values in Istoric, keeps action, actor and time, and adds "Date anonimizate"', async () => {
    const { fake, ctx } = setup();
    await anonymizeAthlete(ctx, 'a1');
    const h = (seq: number) => fake.state.history.find((x) => x.seq === seq);
    expect(h(1)).toMatchObject({ action: HISTORY_ACTIONS.updated, actor: 'ana@example.com', at: AT, changes: { fields: { phone: { from: null, to: null } } } });
    expect(h(2)?.changes).toEqual({ recipient: null, documents: null });
    expect(h(3)?.changes).toEqual({ name: null });
    expect(h(4)?.changes).toEqual({ fields: { phone: { from: '1', to: '2' } } });
    expect(h(5)?.changes).toEqual({ fields: { email: { from: 'x@y.ro', to: 'z@y.ro' } } });
    expect(fake.state.history.filter((x) => x.action === HISTORY_ACTIONS.dataAnonymized)).toEqual([
      expect.objectContaining({ subjectType: SUBJECT.athlete, subjectId: 'a1', actor: 'super@example.com', changes: {} }),
    ]);
  });

  it('deletes the public profile and the duplicate pairs; clears the e-mail queue of its registrations only', async () => {
    const { fake, ctx } = setup();
    await anonymizeAthlete(ctx, 'a1');
    expect(fake.state.profiles).toEqual([]);
    expect(fake.state.removedParticipations).toEqual(['sp1']);
    expect(fake.state.duplicates).toEqual([]);
    expect(fake.state.emailJobs).toEqual([
      { id: 'j1', registrationId: 'r1', recipient: null, subject: null, status: 'sent' },
      { id: 'j2', registrationId: 'r1', recipient: null, subject: null, status: 'cancelled' },
      { id: 'j3', registrationId: 'r1', recipient: null, subject: null, status: 'failed' },
      { id: 'j4', registrationId: 'r2', recipient: 'irina@example.com', subject: 'Înscriere Irina Pereche', status: 'queued' },
    ]);
  });

  it('locks registrations (linked and matched) before the athlete, then removes the PDF folders after the commit', async () => {
    const { fake, ctx, removed } = setup();
    await anonymizeAthlete(ctx, 'a1');
    expect(fake.state.locks).toEqual(['r1', 'r3', 'athlete:a1']);
    expect(removed).toEqual(['r1']);
  });

  it('unknown is 404; a second run is 409 and writes nothing twice', async () => {
    const { fake, ctx } = setup();
    expect(await anonymizeAthlete(ctx, 'nobody')).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
    await anonymizeAthlete(ctx, 'a1');
    expect(await anonymizeAthlete(ctx, 'a1')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
    expect(fake.state.history.filter((x) => x.action === HISTORY_ACTIONS.dataAnonymized)).toHaveLength(1);
  });

  it('a failure halfway saves nothing and deletes no file', async () => {
    const { fake, ctx, removed, logs } = setup();
    fake.failOn('scrubRegistration');
    expect(await anonymizeAthlete(ctx, 'a1')).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect(fake.state.athletes.find((a) => a.id === 'a1')?.name).toBe('Ilinca Zamfirescu');
    expect(fake.state.emailJobs.find((j) => j.id === 'j2')?.status).toBe('queued');
    expect(fake.state.history.find((x) => x.seq === 1)?.changes).toEqual({ fields: { phone: { from: '0722000000', to: '0799123456' } } });
    expect(removed).toEqual([]);
    expect(logs.join('\n')).toContain('[personal-data] anonymizing a1 failed');
  });

  it('a folder that cannot be deleted is logged; the anonymization stands', async () => {
    const { fake, ctx, logs } = setup();
    ctx.removeFiles = async () => { throw new Error('EACCES'); };
    expect((await anonymizeAthlete(ctx, 'a1')).ok).toBe(true);
    expect(fake.state.athletes.find((a) => a.id === 'a1')?.status).toBe('anonimizat');
    expect(logs.join('\n')).toContain('PDF folder of r1');
  });
});

describe('bulk (spec 5)', () => {
  it('each athlete on its own: anonymized, skipped (unknown or already done), failed', async () => {
    const { fake, ctx } = setup();
    const scrubJobs = fake.store.scrubEmailJobs.bind(fake.store);
    fake.store.scrubEmailJobs = async (ids) => {
      if (ids.includes('r2')) throw new Error('boom');
      return scrubJobs(ids);
    };
    expect(await anonymizeAthletes(ctx, ['a1', 'ghost', 'a2'])).toEqual({ ok: true, data: { anonymized: 1, skipped: 1, failed: 1 } });
    expect(fake.state.athletes.find((a) => a.id === 'a2')?.name).toBe('Irina Pereche');
    expect(await anonymizeAthletes(ctx, ['a1'])).toEqual({ ok: true, data: { anonymized: 0, skipped: 1, failed: 0 } });
  });
});

describe('startup sweep (spec 4)', () => {
  it('removes the folders of every registration of an anonymized athlete; a failure is logged and the rest go on', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', status: 'anonimizat' }), athleteRow({ id: 'a2' })],
      registrations: [registrationRow({ id: 'r1', athleteId: 'a1' }), registrationRow({ id: 'r2', athleteId: 'a1' }), registrationRow({ id: 'r3', athleteId: 'a2' })],
    });
    const removed: string[] = [];
    const logs: string[] = [];
    const remove = async (id: string) => {
      if (id === 'r1') throw new Error('EBUSY');
      removed.push(id);
    };
    expect(await sweepAnonymizedFolders(fake.store, remove, (m) => logs.push(m))).toBe(2);
    expect(removed).toEqual(['r2']);
    expect(logs.join('\n')).toContain('r1');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/personal-data/__tests__/anonymize-service.test.ts`
Expected: FAIL (`Cannot find module '../anonymize-service'`).

- [ ] **Step 3: `anonymize-service.ts`**

```ts
import { guarded, refuse, type AdminResult } from '../admin-result';
import { ADMIN_ERRORS } from '../athletes/errors';
import { lockAthletesWithRegistrations } from '../athletes/locks';
import { refreshAllMatches, safely } from '../athletes/matches';
import type { AthleteRow, ClubStore, DuplicateRow, HistoryRow, RegistrationRow, ServiceContext } from '../athletes/store';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { athleteScrub, registrationScrub, scrubChanges, type BulkAnonymizeResult } from './anonymize-plan';

/** Removes one registration's PDF folder; the files live outside the database, so this runs after the commit. */
export type RemoveFiles = (registrationId: string) => Promise<void>;
export type AnonymizeContext = ServiceContext & { removeFiles: RemoveFiles; now: () => Date };

type Done = { documentId: string; registrationIds: string[] };

async function scrubRows(store: ClubStore, rows: HistoryRow[]): Promise<void> {
  for (const row of rows) {
    const next = scrubChanges(row.changes);
    if (JSON.stringify(next) !== JSON.stringify(row.changes)) await store.setHistoryChanges(row.seq, next);
  }
}

/** Istoric of the athlete and its registrations, plus the "Nu e același copil" lines on paired records that name the child. */
async function scrubHistory(store: ClubStore, athlete: AthleteRow, registrations: RegistrationRow[], pairedIds: string[]): Promise<void> {
  await scrubRows(store, await store.history(SUBJECT.athlete, athlete.id));
  for (const r of registrations) await scrubRows(store, await store.history(SUBJECT.registration, r.id));
  for (const otherId of pairedIds) {
    const rows = await store.history(SUBJECT.athlete, otherId);
    await scrubRows(store, rows.filter((h) => h.action === HISTORY_ACTIONS.duplicateDismissed && h.changes.name === athlete.name));
  }
}

async function scrubRegistrations(store: ClubStore, registrations: RegistrationRow[]): Promise<void> {
  await store.scrubEmailJobs(registrations.map((r) => r.id));
  for (const r of registrations) await store.scrubRegistration(r.id, registrationScrub(r.confirmation));
}

const otherOf = (pair: DuplicateRow, id: string): string => (pair.firstId === id ? pair.secondId : pair.firstId);

async function anonymizeInTransaction(ctx: AnonymizeContext, id: string): Promise<AdminResult<Done>> {
  await lockAthletesWithRegistrations(ctx.store, [id]);
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  if (athlete.status === 'anonimizat') return refuse(409, ADMIN_ERRORS.stale);
  const registrations = await ctx.store.registrations({ athleteId: id });
  const pairs = (await ctx.store.duplicates()).filter((d) => d.firstId === id || d.secondId === id);
  await scrubHistory(ctx.store, athlete, registrations, pairs.map((d) => otherOf(d, id)));
  await scrubRegistrations(ctx.store, registrations);
  for (const d of pairs) await ctx.store.deleteDuplicate(d.id);
  if (athlete.profileId) await ctx.store.deleteProfile(athlete.profileId);
  await ctx.store.updateAthlete(id, athleteScrub(ctx.now().toISOString()));
  await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.dataAnonymized, actor: ctx.actor });
  return { ok: true, data: { documentId: id, registrationIds: registrations.map((r) => r.id) } };
}

async function anonymizeOne(ctx: AnonymizeContext, id: string): Promise<AdminResult<Done>> {
  const result = await guarded(ctx.log, `[personal-data] anonymizing ${id}`, () => ctx.store.transaction(() => anonymizeInTransaction(ctx, id)));
  if (result.ok === false) return result;
  for (const registrationId of result.data.registrationIds) {
    await safely(() => ctx.removeFiles(registrationId), ctx.log, `PDF folder of ${registrationId} (the startup sweep retries)`);
  }
  return result;
}

/** "Anonimizează" on the record (spec 4). No undo; the confirmation says so. */
export async function anonymizeAthlete(ctx: AnonymizeContext, id: string): Promise<AdminResult<{ documentId: string }>> {
  const result = await anonymizeOne(ctx, id);
  if (result.ok === false) return result;
  await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after an anonymization');
  return { ok: true, data: { documentId: id } };
}

/** "Anonimizează (k)" (spec 5): each athlete in its own transaction, so one failure never undoes the others. */
export async function anonymizeAthletes(ctx: AnonymizeContext, ids: string[]): Promise<AdminResult<BulkAnonymizeResult>> {
  const counts: BulkAnonymizeResult = { anonymized: 0, skipped: 0, failed: 0 };
  for (const id of ids) {
    const result = await anonymizeOne(ctx, id);
    if (result.ok === true) counts.anonymized += 1;
    else if (result.status === 500) counts.failed += 1;
    else counts.skipped += 1;
  }
  if (counts.anonymized > 0) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after a bulk anonymization');
  return { ok: true, data: counts };
}
```

- [ ] **Step 4: `sweep.ts`**

```ts
import { safely } from '../athletes/matches';
import type { ClubStore } from '../athletes/store';
import type { RemoveFiles } from './anonymize-service';

/** Startup: the PDF folders of anonymized athletes' registrations that an anonymization could not delete (spec 4). */
export async function sweepAnonymizedFolders(store: ClubStore, removeFiles: RemoveFiles, log: (message: string) => void): Promise<number> {
  const ids = await store.anonymizedRegistrationIds();
  for (const id of ids) await safely(() => removeFiles(id), log, `sweeping the PDF folder of ${id}`);
  return ids.length;
}
```

- [ ] **Step 5: Run the tests and the checks**

Run: `npx vitest run src/club/personal-data/__tests__/anonymize-service.test.ts`, `npx vitest run`, `npx tsc --noEmit`
Expected: PASS, PASS, zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/club/personal-data/anonymize-service.ts src/club/personal-data/sweep.ts src/club/personal-data/__tests__/anonymize-service.test.ts
git commit -m "feat(personal-data): anonymize one athlete or a list, then sweep PDF folders"
```

---

### Task 7: Anonymized athletes are never matched, searched, edited or given documents again

**Files:**
- Modify: `src/club/athletes/matches.ts` (`planMatchUpdates`), `src/club/athletes/confirm-read.ts` (`searchAthletes`)
- Modify: `src/club/athletes/record.ts` (`assemble`, `updateAthlete`), `src/club/athletes/add-status.ts` (`setAthleteStatus`), `src/club/athletes/profile.ts` (`createAthleteProfile`, `setAthleteProfileVisibility`), `src/club/athletes/merge.ts` (`mergePreview`, `mergeInTransaction`), `src/club/athletes/delete.ts` (`deleteInTransaction`), `src/club/athletes/confirm-service.ts` (`loadFacts`), `src/club/athletes/undo-service.ts` (`undoLocked`)
- Modify: `src/club/documents/service.ts` (`loadRegistration`)
- Test: `src/club/personal-data/__tests__/anonymized-athletes.test.ts`

**Interfaces:**
- Consumes: Task 3 `isAnonymized`; Task 5 `AthleteRow` (status `anonimizat`); existing `ADMIN_ERRORS.stale` (409), `CONFIRM_ERRORS.failed` (400), `RegistrationNotFoundError`.
- Produces (behaviour later tasks and the boot check rely on):
  - matching (`planMatchUpdates`) and every athlete search (`searchAthletes`: confirm window "Caută alt sportiv" and "Adaugă sportiv") skip `status === 'anonimizat'`;
  - `readAthleteRecord` of an anonymized athlete: `missing: []`, `dataIncomplete: false`, `documents: []`;
  - every athlete write answers `{ ok: false, status: 409, error: ADMIN_ERRORS.stale }` for an anonymized athlete; confirming a registration onto one answers 400 `CONFIRM_ERRORS.failed`; undoing a confirmation whose athlete is anonymized answers 409;
  - `buildRegistrationDocuments` throws `RegistrationNotFoundError` for a registration linked to an anonymized athlete (the admin document route answers 404, the e-mail resend finds no documents).

- [ ] **Step 1: Write the failing test**

`src/club/personal-data/__tests__/anonymized-athletes.test.ts`:

```ts
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { setAthleteStatus } from '../../athletes/add-status';
import { searchAthletes } from '../../athletes/confirm-read';
import { confirmRegistration } from '../../athletes/confirm-service';
import { deleteAthlete } from '../../athletes/delete';
import { ADMIN_ERRORS, CONFIRM_ERRORS } from '../../athletes/errors';
import { planMatchUpdates } from '../../athletes/matches';
import { mergeAthletes, mergePreview } from '../../athletes/merge';
import { createAthleteProfile, setAthleteProfileVisibility } from '../../athletes/profile';
import { readAthleteRecord, updateAthlete } from '../../athletes/record';
import type { ServiceContext } from '../../athletes/store';
import { undoConfirmation } from '../../athletes/undo-service';
import { athleteRow, fakeClubStore, registrationRow } from '../../athletes/__tests__/fake-store';
import { RegistrationNotFoundError, buildRegistrationDocuments } from '../../documents/service';

const ANON = athleteRow({ id: 'a9', name: 'Maria Pop', birthDate: '2016-03-14', status: 'anonimizat', profileId: 'sp9' });
const LIVE = athleteRow({ id: 'a1', name: 'Ana Ionescu', birthDate: '2015-01-01' });
const STALE = { ok: false, status: 409, error: ADMIN_ERRORS.stale };

function setup() {
  const fake = fakeClubStore({
    athletes: [ANON, LIVE],
    profiles: [{ id: 'sp9', name: 'x', slug: 'x', previousSlugs: [], showPublicPage: false, published: true }],
    registrations: [
      registrationRow({ id: 'r1' }),
      registrationRow({ id: 'r5', number: '2026-0155', status: 'Confirmat', athleteId: 'a9', membershipAnswer: 'da', confirmation: {
        athleteId: 'a9', createdAthlete: false, previousStatus: 'Nou', athleteStatusBefore: 'activ', fieldsBefore: {}, fieldsAfter: {},
        membershipId: null, demotedMainId: null, promotedMainId: null, acs: null, seasonId: null, at: '2026-10-03T11:22:00.000Z',
      } }),
    ],
  });
  const ctx: ServiceContext = { store: fake.store, actor: 'ana@example.com', today: { year: 2026, month: 10, day: 27 }, log: () => undefined };
  return { fake, ctx };
}

describe('matching and search skip an anonymized athlete (spec 4)', () => {
  it('never matches a new registration, even with the same name and birth date', () => {
    const reg = registrationRow({ id: 'r1' });
    expect(planMatchUpdates([reg], [ANON])).toEqual([{ registrationId: 'r1', patch: { matchAthleteId: null, matchLevel: null, childBirthDateParsed: '2016-03-14' } }]);
    expect(planMatchUpdates([reg], [{ ...ANON, status: 'activ' }])[0].patch.matchAthleteId).toBe('a9');
  });

  it('never shows in the confirm window search or in "Adaugă sportiv"', async () => {
    const { fake } = setup();
    expect((await searchAthletes(fake.store, 'Maria', null)).map((c) => c.documentId)).toEqual([]);
    expect((await searchAthletes(fake.store, 'Ana', null)).map((c) => c.documentId)).toEqual(['a1']);
  });
});

describe('an anonymized record is read-only (spec 4)', () => {
  it('every write answers 409 and changes nothing', async () => {
    const { fake, ctx } = setup();
    const before = structuredClone(fake.state);
    expect(await updateAthlete(ctx, 'a9', { name: 'X', birthDate: '', contactName: '', phone: '', email: '' })).toEqual(STALE);
    expect(await setAthleteStatus(ctx, 'a9', { status: 'activ' })).toEqual(STALE);
    expect(await createAthleteProfile(ctx, 'a9')).toEqual(STALE);
    expect(await setAthleteProfileVisibility(ctx, 'a9', { on: true })).toEqual(STALE);
    expect(await mergePreview(fake.store, 'a1', 'a9')).toEqual(STALE);
    expect(await mergeAthletes(ctx, { keptId: 'a1', removedId: 'a9', take: [] })).toEqual(STALE);
    expect(await deleteAthlete(ctx, 'a9')).toEqual(STALE);
    expect(fake.state.athletes).toEqual(before.athletes);
    expect(fake.state.history).toEqual([]);
  });

  it('a registration cannot be confirmed onto it, and its confirmation cannot be undone', async () => {
    const { fake, ctx } = setup();
    const request = { choice: 'existing' as const, athleteId: 'a9', groupId: null, makeMain: false, updateFields: null };
    expect(await confirmRegistration(ctx, 'r1', request)).toEqual({ ok: false, status: 400, error: CONFIRM_ERRORS.failed });
    expect(await undoConfirmation(ctx, 'r5')).toEqual(STALE);
    expect(fake.state.registrations.find((r) => r.id === 'r5')?.athleteId).toBe('a9');
  });

  it('its record shows no missing fields, no "Date incomplete" and no documents', async () => {
    const { fake } = setup();
    const record = await readAthleteRecord(fake.store, 'a9', null);
    expect(record).toMatchObject({ status: 'anonimizat', missing: [], dataIncomplete: false, documents: [] });
    expect(record?.registrations.map((r) => r.number)).toEqual(['2026-0155']);
  });
});

describe('no document is rebuilt for an anonymized athlete (spec 4)', () => {
  it('buildRegistrationDocuments refuses and writes no folder', async () => {
    const root = mkdtempSync(join(tmpdir(), 'es3c-docs-'));
    const id = 'reg3canon00000000000001';
    const strapi = {
      dirs: { app: { root } },
      documents: () => ({ findOne: async () => ({ documentId: id, childName: 'Anonimizat', athlete: { status: 'anonimizat' } }) }),
    } as unknown as Core.Strapi;
    const saved = process.env.PRIVATE_FILES_DIR;
    delete process.env.PRIVATE_FILES_DIR;
    try {
      await expect(buildRegistrationDocuments(strapi, id)).rejects.toBeInstanceOf(RegistrationNotFoundError);
    } finally {
      if (saved !== undefined) process.env.PRIVATE_FILES_DIR = saved;
    }
    expect(existsSync(join(root, 'private', 'documents', 'registrations', id))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/personal-data/__tests__/anonymized-athletes.test.ts`
Expected: FAIL (the matching case returns `matchAthleteId: 'a9'`, the writes answer 200).

- [ ] **Step 3: Matching and search**

`src/club/athletes/matches.ts`: add `import { isAnonymized } from '../personal-data/anonymize-plan';` and in `planMatchUpdates` replace the first line:

```ts
  const facts = athletes.filter((a) => !isAnonymized(a)).map(athleteFacts);
```

`src/club/athletes/confirm-read.ts`: add the same import; in `searchAthletes` replace the first line:

```ts
  const [all, registrations] = await Promise.all([store.athletes(), store.registrations()]);
  const athletes = all.filter((a) => !isAnonymized(a));
```

- [ ] **Step 4: Record and the write guards**

Every file below gets `import { isAnonymized } from '../personal-data/anonymize-plan';`.

`src/club/athletes/record.ts`, `assemble`:

```ts
function assemble(a: AthleteRow, src: RecordSource): AthleteRecord {
  const profile = src.profiles.find((p) => p.id === a.profileId);
  const values = pickAthleteValues(a);
  const anonymized = isAnonymized(a);
  return {
    documentId: a.id,
    fields: { ...values, birthDate: birthDateForPicker(a.birthDate) },
    missing: anonymized ? [] : missingFields(values),
    status: a.status,
    dataIncomplete: !anonymized && (a.dataIncomplete || isDataIncomplete(values)),
    header: { birthDate: birthDateForPicker(a.birthDate), mainGroup: mainGroupName(src) },
    season: src.season ? { documentId: src.season.id, label: src.season.label } : null,
    acs: { seasonLabel: src.season?.label ?? null, state: src.acs.find((r) => r.seasonId === src.season?.id)?.state ?? 'nu' },
    registrations: registrationRows(src),
    documents: anonymized ? [] : documentRows(src),
    profile: profile ? { documentId: profile.id, slug: profile.slug, showPublicPage: profile.showPublicPage } : null,
    duplicates: duplicateRows(a.id, src),
    historyCount: src.historyCount,
  };
}
```

`record.ts`, `updateAthlete`, after `if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);`:

```ts
  if (isAnonymized(athlete)) return refuse(409, ADMIN_ERRORS.stale);
```

`src/club/athletes/add-status.ts`, `setAthleteStatus`, after `if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);`: the same line.

`src/club/athletes/profile.ts`, both `createAthleteProfile` and `setAthleteProfileVisibility`, after their `if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);`: the same line.

`src/club/athletes/merge.ts`, `mergePreview`, after `if (!kept || !removed) return refuse(404, ADMIN_ERRORS.notFound);`:

```ts
  if (isAnonymized(kept) || isAnonymized(removed)) return refuse(409, ADMIN_ERRORS.stale);
```

and the same line in `mergeInTransaction`, after its `if (!kept || !removed) return refuse(404, ADMIN_ERRORS.notFound);` (a `MergeSource` carries `status`).

`src/club/athletes/delete.ts`, `deleteInTransaction`, after `if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);`:

```ts
  if (isAnonymized(athlete)) return refuse(409, ADMIN_ERRORS.stale);
```

`src/club/athletes/confirm-service.ts`, `loadFacts`, replace the second line:

```ts
  if (request.choice === 'existing' && (!athlete || isAnonymized(athlete))) return refuse(400, CONFIRM_ERRORS.failed);
```

`src/club/athletes/undo-service.ts`, `undoLocked`, replace the last line:

```ts
  return facts && !isAnonymized(facts.athlete) ? applyUndo(ctx, reg, facts) : refuse(409, ADMIN_ERRORS.stale);
```

- [ ] **Step 5: No document build for an anonymized athlete**

`src/club/documents/service.ts`, replace `loadRegistration`:

```ts
/** A registration of an anonymized athlete has no documents any more (3C spec 4): never rebuilt from its scrubbed row. */
const anonymizedLink = (athlete: unknown): boolean => !!athlete && typeof athlete === 'object' && (athlete as { status?: unknown }).status === 'anonimizat';

async function loadRegistration(strapi: Core.Strapi, documentId: string) {
  const doc = await strapi.documents(UID).findOne({ documentId, populate: { seasonRef: true, athlete: { fields: ['status'] } } });
  if (!doc || anonymizedLink((doc as { athlete?: unknown }).athlete)) throw new RegistrationNotFoundError(documentId);
  const row = doc as unknown as RegistrationRow & { seasonRef?: unknown };
  return { row, season: await seasonOf(strapi, row.seasonRef, row.season) };
}
```

- [ ] **Step 6: Run the tests and the checks**

Run: `npx vitest run src/club/personal-data/__tests__/anonymized-athletes.test.ts`, `npx vitest run`, `npx tsc --noEmit`
Expected: PASS, PASS (the phase 2 document tests stub `findOne` and ignore `populate`), zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/club/athletes/matches.ts src/club/athletes/confirm-read.ts src/club/athletes/record.ts src/club/athletes/add-status.ts src/club/athletes/profile.ts src/club/athletes/merge.ts src/club/athletes/delete.ts src/club/athletes/confirm-service.ts src/club/athletes/undo-service.ts src/club/documents/service.ts src/club/personal-data/__tests__/anonymized-athletes.test.ts
git commit -m "feat(personal-data): anonymized athletes are never matched, searched, edited or given documents"
```

---

### Task 8: Sportivi list on the server: anonymized hidden, inactivity filter, yearly review

**Files:**
- Modify: `src/club/athletes/list.ts` (`AthleteListQuery`, `readFilters`, `ListSource`, `Derived`, `Index`, `buildIndex`, `publicRow`, `derive`, `TESTS`, `listAthletes`, `athleteListPage`)
- Modify: `src/club/athletes/api-types.ts` (`AthleteListPage`)
- Create: `src/club/personal-data/review.ts`
- Test: `src/club/personal-data/__tests__/list-review.test.ts`

**Interfaces:**
- Consumes: Task 2 `inactiveAthleteIds`, `readPersonalDataSettings`, `hiddenUntil`, `reviewNoticeShown`, `DEFAULT_RETENTION_YEARS`, `InactiveSummary`; Task 5 `personalDataSettings`, `savePersonalDataSettings`, `AthleteRow.createdAt`.
- Produces:
  - `GET /api/club/athletes` query `inactive=true` (only athletes of `inactiveAthleteIds`); with no `status` filter both `inactiv` and `anonimizat` are hidden; `status=anonimizat` shows them; `unfiltered` and `incomplete` count neither.
  - `AthleteListPage.retentionYears: number`; an anonymized row has `missing: []` and `dataIncomplete: false`.
  - `athleteListPage(store, q, today, now = new Date())`.
  - `inactiveSummary(store: ClubStore, now: Date): Promise<InactiveSummary>`
  - `hideInactiveReview(ctx: ServiceContext, now: Date): Promise<AdminResult<InactiveSummary>>` (409 `ADMIN_ERRORS.stale` when no current season)

- [ ] **Step 1: Write the failing test**

`src/club/personal-data/__tests__/list-review.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { athleteListPage, readListQuery } from '../../athletes/list';
import type { SeasonRow, ServiceContext } from '../../athletes/store';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { SEASONS, athleteRow, fakeClubStore } from '../../athletes/__tests__/fake-store';
import { hideInactiveReview, inactiveSummary } from '../review';

const OLD_SEASONS: SeasonRow[] = [
  { id: 's21', label: '2021-2022', startMonth: '2021-10-01', endMonth: '2022-05-31', isCurrent: false },
  ...SEASONS,
];
const NOW = new Date('2026-10-27T09:00:00.000Z');
const TODAY = { year: 2026, month: 10, day: 27 };
const member = (id: string, athleteId: string, seasonId: string) => ({ id, athleteId, groupId: 'g-pp', seasonId, isMain: true, from: null });

function setup(settings: unknown = null, seasons: SeasonRow[] = OLD_SEASONS) {
  return fakeClubStore({
    seasons,
    settings,
    athletes: [
      athleteRow({ id: 'old', name: 'Vechi Unu', birthDate: '2012-01-01', contactName: 'P', phone: '07', email: 'p@x.ro' }),
      athleteRow({ id: 'cur', name: 'Activ Doi' }),
      athleteRow({ id: 'anon', name: 'Sportiv anonimizat', status: 'anonimizat' }),
      athleteRow({ id: 'none', name: 'Fără Nimic', createdAt: '2020-01-01T00:00:00.000Z' }),
    ],
    memberships: [member('m1', 'old', 's21'), member('m2', 'cur', 's26'), member('m3', 'anon', 's21')],
  });
}

const page = async (store: ReturnType<typeof setup>['store'], query: Record<string, string>) => athleteListPage(store, readListQuery(query), TODAY, NOW);
const names = (p: Awaited<ReturnType<typeof page>>) => p.data.map((r) => r.name);

describe('Sportivi list, 3C (spec 4, 5)', () => {
  it('hides anonymized athletes unless the status filter asks for them; counts leave them out', async () => {
    const { store } = setup();
    const all = await page(store, {});
    expect(names(all)).toEqual(['Activ Doi', 'Fără Nimic', 'Vechi Unu']);
    expect(all.unfiltered).toBe(3);
    const anonymized = await page(store, { status: 'anonimizat' });
    expect(names(anonymized)).toEqual(['Sportiv anonimizat']);
    expect(anonymized.data[0]).toMatchObject({ missing: [], dataIncomplete: false });
  });

  it('"Inactivi de peste N ani" lists only the inactive, with N from the settings', async () => {
    const { store } = setup();
    const inactive = await page(store, { inactive: 'true' });
    expect(names(inactive)).toEqual(['Fără Nimic', 'Vechi Unu']);
    expect(inactive.retentionYears).toBe(5);
    const six = await page(setup({ retentionYears: 6 }).store, { inactive: 'true' });
    expect(names(six)).toEqual(['Fără Nimic']);
    expect(six.retentionYears).toBe(6);
  });
});

describe('yearly review (spec 5)', () => {
  it('counts the inactive athletes and shows the notice', async () => {
    expect(await inactiveSummary(setup().store, NOW)).toEqual({ retentionYears: 5, count: 2, seasonLabel: '2026-2027', shown: true });
  });

  it('"Ascunde până la sezonul următor" hides it for the current season only', async () => {
    const fake = setup({ retentionYears: 6 });
    const ctx: ServiceContext = { store: fake.store, actor: 'super@example.com', today: TODAY, log: () => undefined };
    expect(await hideInactiveReview(ctx, NOW)).toEqual({ ok: true, data: { retentionYears: 6, count: 1, seasonLabel: '2026-2027', shown: false } });
    expect(fake.state.settings).toEqual({ retentionYears: 6, reviewHiddenUntilSeason: '2026-2027' });
  });

  it('without a current season there is nothing to hide', async () => {
    const fake = setup(null, OLD_SEASONS.map((s) => ({ ...s, isCurrent: false })));
    const ctx: ServiceContext = { store: fake.store, actor: 'super@example.com', today: TODAY, log: () => undefined };
    expect(await hideInactiveReview(ctx, NOW)).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/personal-data/__tests__/list-review.test.ts`
Expected: FAIL (`Cannot find module '../review'`).

- [ ] **Step 3: `list.ts`**

Imports, add:

```ts
import { inactiveAthleteIds } from '../personal-data/inactivity';
import { DEFAULT_RETENTION_YEARS, readPersonalDataSettings } from '../personal-data/settings';
```

`AthleteListQuery`: add `inactive: boolean;` after `duplicates: boolean;`. `readFilters`: add `inactive: q.inactive === 'true',` after the `duplicates` line.

`ListSource`: add at the end `inactiveIds?: ReadonlySet<string>; retentionYears?: number;`. `Derived`: add `inactive: boolean`. `Index`: add `inactiveIds: ReadonlySet<string>`. `buildIndex`: add `inactiveIds: src.inactiveIds ?? new Set<string>(),`. `derive`: add `inactive: ix.inactiveIds.has(a.id),`.

`publicRow`, first line:

```ts
  const missing = a.status === 'anonimizat' ? [] : missingFields(pickAthleteValues(a));
```

Above `TESTS`:

```ts
/** No Status filter: the list hides inactive and anonymized athletes (spec 5, 3C spec 4). */
const shownByDefault = (status: AthleteStatus): boolean => status !== 'inactiv' && status !== 'anonimizat';
```

`TESTS`: replace the first test and add one at the end:

```ts
  (d, q) => (q.status.length ? q.status.includes(d.row.status) : shownByDefault(d.row.status)),
```

```ts
  (d, q) => !q.inactive || d.inactive,
```

`listAthletes`: `const listed = all.filter((d) => shownByDefault(d.row.status));` and add `retentionYears: src.retentionYears ?? DEFAULT_RETENTION_YEARS,` to the returned object (after `options`).

`athleteListPage`:

```ts
export async function athleteListPage(store: ClubStore, q: AthleteListQuery, today: DateParts, now: Date = new Date()): Promise<AthleteListPage> {
  const [athletes, registrations, memberships, acs, groups, sections, profiles, duplicates, seasons, rawSettings] = await Promise.all([
    store.athletes(), store.registrations(), store.memberships(), store.acsRows(), store.groups(), store.sections(), store.profiles(), store.duplicates(), store.seasons(),
    store.personalDataSettings(),
  ]);
  const season = seasons.find((s) => s.id === q.seasonId) ?? seasons.find((s) => s.isCurrent) ?? null;
  const { retentionYears } = readPersonalDataSettings(rawSettings);
  const inactiveIds = inactiveAthleteIds({ athletes, memberships, registrations, seasons, retentionYears, now });
  return listAthletes({ athletes, registrations, memberships, acs, groups, sections, profiles, duplicates, seasons, season, today, inactiveIds, retentionYears }, q);
}
```

If an existing test builds an `AthleteListQuery` literal by hand, add `inactive: false` to it.

`src/club/athletes/api-types.ts`, `AthleteListPage`: add `retentionYears: number;` after `options`.

- [ ] **Step 4: `review.ts`**

```ts
import { guardedWrite, refuse, type AdminResult } from '../admin-result';
import { ADMIN_ERRORS } from '../athletes/errors';
import type { ClubStore, ServiceContext } from '../athletes/store';
import { inactiveAthleteIds } from './inactivity';
import { hiddenUntil, readPersonalDataSettings, reviewNoticeShown, type InactiveSummary } from './settings';

/** GET /api/club/athletes/inactive-summary (spec 5): the dashboard notice. Reads only; nothing runs by itself. */
export async function inactiveSummary(store: ClubStore, now: Date): Promise<InactiveSummary> {
  const [athletes, memberships, registrations, seasons, raw] = await Promise.all([
    store.athletes(), store.memberships(), store.registrations(), store.seasons(), store.personalDataSettings(),
  ]);
  const settings = readPersonalDataSettings(raw);
  const count = inactiveAthleteIds({ athletes, memberships, registrations, seasons, retentionYears: settings.retentionYears, now }).size;
  const seasonLabel = seasons.find((s) => s.isCurrent)?.label ?? null;
  return { retentionYears: settings.retentionYears, count, seasonLabel, shown: reviewNoticeShown(settings, count, seasonLabel) };
}

/** "Ascunde până la sezonul următor" (Super Admin): stores the current season label. */
export async function hideInactiveReview(ctx: ServiceContext, now: Date): Promise<AdminResult<InactiveSummary>> {
  const seasonLabel = (await ctx.store.seasons()).find((s) => s.isCurrent)?.label ?? null;
  if (!seasonLabel) return refuse(409, ADMIN_ERRORS.stale);
  const saved = await guardedWrite(ctx.log, '[personal-data] hiding the yearly review', async () => {
    const settings = readPersonalDataSettings(await ctx.store.personalDataSettings());
    await ctx.store.savePersonalDataSettings(hiddenUntil(settings, seasonLabel));
  });
  return saved.ok === false ? saved : { ok: true, data: await inactiveSummary(ctx.store, now) };
}
```

- [ ] **Step 5: Run the tests and the checks**

Run: `npx vitest run src/club/personal-data/__tests__/list-review.test.ts src/club/athletes/__tests__/list.test.ts`, `npx vitest run`, `npx tsc --noEmit`
Expected: PASS, PASS, zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/club/athletes/list.ts src/club/athletes/api-types.ts src/club/personal-data/review.ts src/club/personal-data/__tests__/list-review.test.ts
git commit -m "feat(personal-data): inactivity filter, anonymized status in the list and the yearly review"
```

---

### Task 9: "Exportă datele": ZIP and export service

**Files:**
- Modify: `package.json`, `package-lock.json` (`fflate` as a direct dependency)
- Create: `src/club/personal-data/export-zip.ts`, `src/club/personal-data/export-service.ts`
- Test: `src/club/personal-data/__tests__/export.test.ts`

**Interfaces:**
- Consumes: Task 4 `buildSummaryModel`, `renderSummaryPdf`, `SummaryInput`, `SummaryRegistration`; Task 5 `registrationRecords`; Task 3 `isAnonymized`; existing `readHistory` (`athletes/history-read.ts`), `registrationSeasonLabel` (`athletes/cards.ts`), `isScriptFormRegistration`, `registrationDocumentKinds` (`registration-panel.ts`), `actorLabel`, `HISTORY_ACTIONS.dataExported`, `slugify` (`profile-slug.ts`), `todayInBucharest`, `isoDate` (`birth-date.ts`), `guarded`, `refuse`, `safely`.
- Produces:
  - `type ZipEntry = { folder: string; fileName: string; data: Uint8Array }`
  - `exportFileName(name: string | null, now: Date): string` (`date-<slug>-<YYYY-MM-DD>.zip`, Bucharest date)
  - `zipExport(summary: Uint8Array, entries: ZipEntry[]): Uint8Array` (`rezumat.pdf` + `inscrieri/<nr>/<file>`)
  - `zipHeaders(fileName: string): Record<string, string>`
  - `type ExportDocument = { kind: DocumentKind; fileName: string; data: Uint8Array }`
  - `type ExportContext = ServiceContext & { storedDocuments: (registrationId: string) => Promise<ExportDocument[]>; now: () => Date }`
  - `type ExportFile = { fileName: string; data: Uint8Array }`
  - `exportAthleteData(ctx: ExportContext, id: string): Promise<AdminResult<ExportFile>>` (404 unknown or anonymized; 500 shared text; "Date exportate" after success, its failure only logged)

- [ ] **Step 1: Add the dependency**

Run: `npm install --save fflate@^0.8.3`
Expected: `package.json` lists `"fflate": "^0.8.3"` under `dependencies` (it was only a transitive package) and `package-lock.json` changes; `node_modules/fflate` stays at 0.8.3.

- [ ] **Step 2: Write the failing test**

`src/club/personal-data/__tests__/export.test.ts`:

```ts
import { unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { athleteRow, fakeClubStore, registrationRow } from '../../athletes/__tests__/fake-store';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { pdfText } from '../../documents/__tests__/pdf-text';
import { HISTORY_ACTIONS } from '../../history-text';
import { exportAthleteData, type ExportContext, type ExportDocument } from '../export-service';
import { exportFileName, zipExport, zipHeaders } from '../export-zip';

vi.setConfig({ testTimeout: 30_000 });

const NOW = new Date('2026-10-27T10:00:00.000Z');
const PDF = new Uint8Array([37, 80, 68, 70, 45, 49]);

function setup(stored: Record<string, ExportDocument[]> = { r1: [{ kind: 'acord', fileName: 'Ilinca-Zamfirescu_Acord_2026-2027.pdf', data: PDF }] }) {
  const fake = fakeClubStore({
    athletes: [
      athleteRow({ id: 'a1', name: 'Ilinca Zamfirescu', birthDate: '2013-04-27', contactName: 'Dana Zamfirescu', phone: '0799 123 456', email: 'dana@example.com' }),
      athleteRow({ id: 'a9', name: 'Sportiv anonimizat', status: 'anonimizat' }),
    ],
    registrations: [
      registrationRow({ id: 'r1', childName: 'Ilinca Zamfirescu', athleteId: 'a1', status: 'Confirmat', membershipAnswer: 'da' }),
      registrationRow({ id: 'r4', number: '2019-0007', season: '2019-2020', seasonId: null, childName: 'Ilinca Zamfirescu', athleteId: 'a1', membershipAnswer: null }),
    ],
    registrationRecords: { r1: { relationship: 'parinte', gdprConsent: true, regulationsConsent: true } },
    memberships: [{ id: 'gm1', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null }],
    acs: [{ id: 'acs1', athleteId: 'a1', seasonId: 's26', state: 'da' }],
    admins: { 'ana@example.com': 'Ana Admin' },
  });
  const logs: string[] = [];
  const ctx: ExportContext = {
    store: fake.store, actor: 'ana@example.com', today: { year: 2026, month: 10, day: 27 }, log: (m) => logs.push(m),
    storedDocuments: async (id) => stored[id] ?? [], now: () => NOW,
  };
  return { fake, ctx, logs };
}

const files = (zip: Uint8Array) => unzipSync(zip);
const fileNames = (zip: Uint8Array) => Object.keys(files(zip)).filter((n) => !n.endsWith('/')).sort();

describe('ZIP (spec 3)', () => {
  it('names the file after the child and the Bucharest date', () => {
    expect(exportFileName('Ilinca Zamfirescu', NOW)).toBe('date-ilinca-zamfirescu-2026-10-27.zip');
    expect(exportFileName('Ștefan Țăranu', new Date('2026-10-27T22:30:00.000Z'))).toBe('date-stefan-taranu-2026-10-28.zip');
    expect(exportFileName(null, NOW)).toBe('date-sportiv-2026-10-27.zip');
  });

  it('holds rezumat.pdf and each registration PDF under inscrieri/<nr>/', () => {
    const zip = zipExport(PDF, [{ folder: '2026-0142', fileName: 'A.pdf', data: PDF }, { folder: '2026-0142', fileName: 'B.pdf', data: PDF }]);
    expect(fileNames(zip)).toEqual(['inscrieri/2026-0142/A.pdf', 'inscrieri/2026-0142/B.pdf', 'rezumat.pdf']);
    expect(fileNames(zipExport(PDF, []))).toEqual(['rezumat.pdf']);
  });

  it('is sent as a private download', () => {
    expect(zipHeaders('date-x-2026-10-27.zip')).toEqual({
      'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="date-x-2026-10-27.zip"',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex',
    });
  });
});

describe('export service (spec 3)', () => {
  it('builds the ZIP: summary plus the stored PDFs as they are', async () => {
    const { ctx } = setup();
    const result = await exportAthleteData(ctx, 'a1');
    if (result.ok !== true) throw new Error('export refused');
    expect(result.data.fileName).toBe('date-ilinca-zamfirescu-2026-10-27.zip');
    expect(fileNames(result.data.data)).toEqual(['inscrieri/2026-0142/Ilinca-Zamfirescu_Acord_2026-2027.pdf', 'rezumat.pdf']);
    expect(files(result.data.data)['inscrieri/2026-0142/Ilinca-Zamfirescu_Acord_2026-2027.pdf']).toEqual(PDF);
  });

  it('the summary lists a missing PDF as "Document indisponibil", never for an old registration without PDFs', async () => {
    const { ctx } = setup();
    const result = await exportAthleteData(ctx, 'a1');
    if (result.ok !== true) throw new Error('export refused');
    const { text } = await pdfText(Buffer.from(files(result.data.data)['rezumat.pdf']));
    expect(text).toContain('Date personale: Ilinca Zamfirescu');
    expect(text).toContain('Înscrierea 2026-0142');
    expect(text).toContain('Înscrierea 2019-0007');
    expect(text.match(/Document indisponibil/g)).toHaveLength(1);
    expect(text).toContain('Generat la 27.10.2026, 12:00, de Ana Admin.');
  });

  it('writes "Date exportate" after a successful export; a failed history write still delivers', async () => {
    const { fake, ctx, logs } = setup();
    await exportAthleteData(ctx, 'a1');
    expect(fake.state.history.filter((h) => h.action === HISTORY_ACTIONS.dataExported)).toEqual([
      expect.objectContaining({ subjectId: 'a1', actor: 'ana@example.com', changes: {} }),
    ]);
    fake.failOn('record');
    expect((await exportAthleteData(ctx, 'a1')).ok).toBe(true);
    expect(logs.join('\n')).toContain('export history of a1');
  });

  it('unknown or anonymized: 404; a build failure: the shared text and no history line', async () => {
    const { fake, ctx } = setup();
    expect(await exportAthleteData(ctx, 'ghost')).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
    expect(await exportAthleteData(ctx, 'a9')).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
    ctx.storedDocuments = async () => { throw new Error('EIO'); };
    expect(await exportAthleteData(ctx, 'a1')).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect(fake.state.history).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/club/personal-data/__tests__/export.test.ts`
Expected: FAIL (`Cannot find module '../export-service'`).

- [ ] **Step 4: `export-zip.ts`**

```ts
import { zipSync } from 'fflate';
import { isoDate, todayInBucharest } from '../birth-date';
import { slugify } from '../profile-slug';

/** One registration PDF in the ZIP: `inscrieri/<folder>/<fileName>`, the folder being the registration number. */
export type ZipEntry = { folder: string; fileName: string; data: Uint8Array };

/** `date-<slug-of-name>-<YYYY-MM-DD>.zip`, the date in Bucharest (spec 3). */
export const exportFileName = (name: string | null, now: Date): string => `date-${slugify(name ?? '')}-${isoDate(todayInBucharest(now))}.zip`;

/** Built in memory (spec 3): `rezumat.pdf` at the root, each registration's stored PDFs under `inscrieri/<nr>/`. */
export function zipExport(summary: Uint8Array, entries: ZipEntry[]): Uint8Array {
  const folders: Record<string, Record<string, Uint8Array>> = {};
  for (const e of entries) folders[e.folder] = { ...folders[e.folder], [e.fileName]: e.data };
  return zipSync({ 'rezumat.pdf': summary, ...(entries.length ? { inscrieri: folders } : {}) });
}

/** Never cached, never indexed, saved under its own name (like the registration PDFs). */
export function zipHeaders(fileName: string): Record<string, string> {
  return {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
  };
}
```

- [ ] **Step 5: `export-service.ts`**

```ts
import { guarded, refuse, type AdminResult } from '../admin-result';
import { registrationSeasonLabel } from '../athletes/cards';
import { ADMIN_ERRORS } from '../athletes/errors';
import { readHistory } from '../athletes/history-read';
import { safely } from '../athletes/matches';
import type { AcsRow, AthleteRow, ClubStore, GroupRow, MembershipRow, RegistrationRow, SeasonRow, SectionRow, ServiceContext } from '../athletes/store';
import type { DocumentKind } from '../documents/types';
import { HISTORY_ACTIONS, SUBJECT, actorLabel } from '../history-text';
import { isScriptFormRegistration, registrationDocumentKinds } from '../registration-panel';
import { isAnonymized } from './anonymize-plan';
import { exportFileName, zipExport, type ZipEntry } from './export-zip';
import { buildSummaryModel, type SummaryInput, type SummaryRegistration } from './summary-model';
import { renderSummaryPdf } from './summary-pdf';

export type ExportDocument = { kind: DocumentKind; fileName: string; data: Uint8Array };
export type ExportContext = ServiceContext & { storedDocuments: (registrationId: string) => Promise<ExportDocument[]>; now: () => Date };
export type ExportFile = { fileName: string; data: Uint8Array };

type Facts = {
  seasons: SeasonRow[]; groups: GroupRow[]; sections: SectionRow[]; memberships: MembershipRow[]; acs: AcsRow[];
  registrations: RegistrationRow[]; records: Record<string, unknown>[];
};

async function loadFacts(store: ClubStore, id: string): Promise<Facts> {
  const [seasons, groups, sections, memberships, acs, registrations, records] = await Promise.all([
    store.seasons(), store.groups(), store.sections(), store.memberships(id), store.acsRows(id), store.registrations({ athleteId: id }), store.registrationRecords(id),
  ]);
  return { seasons, groups, sections, memberships, acs, registrations, records };
}

const labelOf = (seasons: SeasonRow[], id: string): string => seasons.find((s) => s.id === id)?.label ?? '';
const newestFirst = <T extends { season: string }>(rows: T[]): T[] => [...rows].sort((a, b) => b.season.localeCompare(a.season));

const groupLines = (f: Facts): SummaryInput['groups'] =>
  newestFirst(f.memberships.map((m) => ({ season: labelOf(f.seasons, m.seasonId), group: f.groups.find((g) => g.id === m.groupId)?.name ?? '', main: m.isMain })));
const acsLines = (f: Facts): SummaryInput['acs'] => newestFirst(f.acs.map((r) => ({ season: labelOf(f.seasons, r.seasonId), state: r.state })));

/** The PDFs a registration should have; none for an old registration from before the phase 2 form. */
const expectedKinds = (record: Record<string, unknown>): DocumentKind[] => (isScriptFormRegistration(record) ? registrationDocumentKinds(record) : []);

type Loaded = { registrations: SummaryRegistration[]; entries: ZipEntry[] };

async function loadRegistrations(ctx: ExportContext, f: Facts): Promise<Loaded> {
  const out: Loaded = { registrations: [], entries: [] };
  for (const r of f.registrations) {
    const record = f.records.find((x) => x.documentId === r.id) ?? {};
    const docs = await ctx.storedDocuments(r.id);
    out.entries.push(...docs.map((d) => ({ folder: r.number ?? r.id, fileName: d.fileName, data: d.data })));
    out.registrations.push({
      number: r.number ?? '', record, seasonLabel: registrationSeasonLabel(r, f.seasons), sectionName: f.sections.find((s) => s.id === r.sectionId)?.name ?? null,
      missingDocuments: expectedKinds(record).filter((kind) => !docs.some((d) => d.kind === kind)),
    });
  }
  return out;
}

async function historyLines(store: ClubStore, athleteId: string, registrations: RegistrationRow[]): Promise<SummaryInput['history']> {
  const own = (await readHistory(store, SUBJECT.athlete, athleteId)).map((l) => ({ ...l, subject: '' }));
  const regs = await Promise.all(registrations.map(async (r) =>
    (await readHistory(store, SUBJECT.registration, r.id, r.submittedAt)).map((l) => ({ ...l, subject: r.number ?? '' }))));
  return [...own, ...regs.flat()].sort((a, b) => b.at.localeCompare(a.at));
}

async function buildExport(ctx: ExportContext, athlete: AthleteRow): Promise<AdminResult<ExportFile>> {
  const facts = await loadFacts(ctx.store, athlete.id);
  const loaded = await loadRegistrations(ctx, facts);
  const names = await ctx.store.adminNames([ctx.actor]);
  const now = ctx.now();
  const model = buildSummaryModel({
    athlete, groups: groupLines(facts), acs: acsLines(facts), registrations: loaded.registrations,
    history: await historyLines(ctx.store, athlete.id, facts.registrations), generatedAt: now, generatedBy: actorLabel(ctx.actor, names),
  });
  const summary = await renderSummaryPdf(model);
  return { ok: true, data: { fileName: exportFileName(athlete.name, now), data: zipExport(summary, loaded.entries) } };
}

/** "Exportă datele" (spec 3), any admin. The history line is written after the ZIP is built; its failure is only logged. */
export async function exportAthleteData(ctx: ExportContext, id: string): Promise<AdminResult<ExportFile>> {
  const athlete = await ctx.store.athlete(id);
  if (!athlete || isAnonymized(athlete)) return refuse(404, ADMIN_ERRORS.notFound);
  const built = await guarded(ctx.log, `[personal-data] exporting ${id}`, () => buildExport(ctx, athlete));
  if (built.ok === true) {
    const entry = { subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.dataExported, actor: ctx.actor };
    await safely(() => ctx.store.record(entry), ctx.log, `export history of ${id}`);
  }
  return built;
}
```

- [ ] **Step 6: Run the tests and the checks**

Run: `npx vitest run src/club/personal-data/__tests__/export.test.ts`, `npx vitest run`, `npx tsc --noEmit`
Expected: PASS, PASS, zero errors. If `registrationDocumentKinds` is typed on `PanelDocumentKind`, the two unions are the same strings: keep it, `tsc` accepts it as `DocumentKind[]`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/club/personal-data/export-zip.ts src/club/personal-data/export-service.ts src/club/personal-data/__tests__/export.test.ts
git commit -m "feat(personal-data): export one athlete's data as a ZIP with a summary PDF"
```

---

### Task 10: Super Admin policy, routes, controllers, startup sweep

**Files:**
- Modify: `src/club/admin-actor.ts` (export `adminIdFrom`)
- Create: `src/club/personal-data/roles.ts`, `src/club/personal-data/super-admin.ts`, `src/club/personal-data/http.ts`
- Create: `src/policies/is-super-admin.ts`
- Create: `src/api/club/controllers/personal-data.ts`; Modify: `src/api/club/routes/05-athletes.ts`
- Modify: `src/index.ts` (bootstrap)
- Modify: `src/club/__tests__/athlete-routes.test.ts`
- Test: `src/club/personal-data/__tests__/super-admin.test.ts`

**Interfaces:**
- Consumes: Tasks 6, 8, 9 (`anonymizeAthlete`, `anonymizeAthletes`, `sweepAnonymizedFolders`, `AnonymizeContext`, `inactiveSummary`, `hideInactiveReview`, `exportAthleteData`, `ExportContext`, `ExportDocument`, `zipHeaders`), Task 3 `readAnonymizeIds`; existing `serviceContext`, `clubStore` (`athletes/http.ts`), `respond`, `refuseWith`, `AdminCtx` (`admin-http.ts`), `deleteRegistrationDocuments`, `listRegistrationDocuments` (`documents/index.ts`).
- Produces:
  - `roles.ts` (pure, admin bundle too): `SUPER_ADMIN_CODE = 'strapi-super-admin'`, `hasSuperAdminRole(user: unknown): boolean`, `superAdminFromMe(body: unknown): boolean` (body of `GET /admin/users/me`, `{ data: { roles: [{ code }] } }`)
  - `super-admin.ts` (server): `isSuperAdminRequest(authorization: string | undefined, strapi: RoleStrapi): Promise<boolean>`
  - policy `global::is-super-admin` (`src/policies/is-super-admin.ts`); a refusal is Strapi's 403.
  - `http.ts`: `anonymizeContext(strapi, ctx): Promise<AnonymizeContext>`, `exportContext(strapi, ctx): Promise<ExportContext>`, `startPersonalDataSweep(strapi): void`
  - Routes (all `auth: false`):
    - `GET /api/club/athletes/inactive-summary` (`global::is-admin`) -> `{ data: InactiveSummary }`
    - `POST /api/club/athletes/inactive-summary/hide` (`global::is-super-admin`) -> `{ data: InactiveSummary }`
    - `POST /api/club/athletes/anonymize` body `{ documentIds: string[] }` (`global::is-super-admin`) -> `{ data: BulkAnonymizeResult }`, 400 `ADMIN_ERRORS.invalid` for a bad body
    - `GET /api/club/athletes/:documentId/export` (`global::is-admin`) -> `application/zip`
    - `POST /api/club/athletes/:documentId/anonymize` (`global::is-super-admin`) -> `{ data: { documentId } }`, 404, 409

- [ ] **Step 1: Write the failing tests**

`src/club/personal-data/__tests__/super-admin.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Core } from '@strapi/strapi';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import policy from '../../../policies/is-super-admin';
import { hasSuperAdminRole, superAdminFromMe } from '../roles';
import { isSuperAdminRequest, type RoleStrapi } from '../super-admin';

const SECRET = 'test-secret';
const USERS: Record<number, unknown> = { 1: { id: 1, roles: [{ code: 'strapi-super-admin' }] }, 2: { id: 2, roles: [{ code: 'strapi-editor' }] } };
const bearer = (userId: number, secret = SECRET) => `Bearer ${jwt.sign({ userId }, secret)}`;
const asked: unknown[] = [];
const strapi: RoleStrapi = {
  config: { get: (key: string) => (key === 'admin.auth.secret' ? SECRET : undefined) },
  db: { query: () => ({ findOne: async (args) => { asked.push(args); return USERS[Number(args.where.id)] ?? null; } }) },
};

describe('global::is-super-admin (3C spec 6)', () => {
  it('allows a Super Admin, loading the admin with roles', async () => {
    expect(await isSuperAdminRequest(bearer(1), strapi)).toBe(true);
    expect(asked.at(-1)).toEqual({ where: { id: 1 }, populate: ['roles'] });
  });

  it('refuses an editor, an unknown admin, a wrong signature and no token', async () => {
    expect(await isSuperAdminRequest(bearer(2), strapi)).toBe(false);
    expect(await isSuperAdminRequest(bearer(9), strapi)).toBe(false);
    expect(await isSuperAdminRequest(bearer(1, 'other'), strapi)).toBe(false);
    expect(await isSuperAdminRequest(undefined, strapi)).toBe(false);
  });

  it('the policy reads the Authorization header', async () => {
    const ctx = (authorization?: string) => ({ request: { header: { authorization } } });
    expect(await policy(ctx(bearer(1)), {}, { strapi: strapi as unknown as Core.Strapi })).toBe(true);
    expect(await policy(ctx(bearer(2)), {}, { strapi: strapi as unknown as Core.Strapi })).toBe(false);
  });

  it('the admin UI reads the role from /admin/users/me', () => {
    expect(superAdminFromMe({ data: { roles: [{ code: 'strapi-super-admin' }] } })).toBe(true);
    expect(superAdminFromMe({ data: { roles: [{ code: 'strapi-author' }] } })).toBe(false);
    expect(superAdminFromMe(null)).toBe(false);
    expect(hasSuperAdminRole({ roles: 'strapi-super-admin' })).toBe(false);
  });

  it('roles.ts stays importable by the admin bundle (no jsonwebtoken, no Node modules)', () => {
    const src = readFileSync(join(__dirname, '..', 'roles.ts'), 'utf8');
    expect(src).not.toMatch(/from '(jsonwebtoken|node:|\.\.\/admin-actor)/);
  });
});

describe('startup sweep is wired (3C spec 4)', () => {
  it('bootstrap starts it without awaiting it', () => {
    const index = readFileSync(join(__dirname, '..', '..', '..', 'index.ts'), 'utf8');
    expect(index).toContain('startPersonalDataSweep(strapi);');
  });
});
```

In `src/club/__tests__/athlete-routes.test.ts` replace the imports of the controllers and the first test, and add two:

```ts
import athletes from '../../api/club/controllers/athletes';
import personalData from '../../api/club/controllers/personal-data';
import registrations from '../../api/club/controllers/registrations';
import athleteRoutes from '../../api/club/routes/05-athletes';
import registrationRoutes from '../../api/club/routes/04-registrations';

const controllers: Record<string, Record<string, unknown>> = { athletes, registrations, 'personal-data': personalData };
const SUPER_ADMIN_ONLY = ['POST /club/athletes/inactive-summary/hide', 'POST /club/athletes/anonymize', 'POST /club/athletes/:documentId/anonymize'];
const route = (method: string, path: string) => athleteRoutes.routes.find((r) => r.method === method && r.path === path);
```

```ts
  it('are all admin-only; anonymizing and hiding the yearly review need a Super Admin (3C spec 6)', () => {
    for (const r of all) {
      const policy = SUPER_ADMIN_ONLY.includes(`${r.method} ${r.path}`) ? 'global::is-super-admin' : 'global::is-admin';
      expect(r.config, `${r.method} ${r.path}`).toEqual({ auth: false, policies: [policy], middlewares: [] });
    }
  });

  it('export is for any admin, both anonymize routes for a Super Admin (3C spec 8)', () => {
    expect(route('GET', '/club/athletes/:documentId/export')?.config.policies).toEqual(['global::is-admin']);
    expect(route('POST', '/club/athletes/:documentId/anonymize')?.config.policies).toEqual(['global::is-super-admin']);
    expect(route('POST', '/club/athletes/anonymize')?.config.policies).toEqual(['global::is-super-admin']);
    expect(route('GET', '/club/athletes/inactive-summary')?.handler).toBe('personal-data.inactiveSummary');
  });
```

(the old `are all admin-only` case is replaced; `point at handlers that exist` and the order case stay and now cover the new routes.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/club/personal-data/__tests__/super-admin.test.ts src/club/__tests__/athlete-routes.test.ts`
Expected: FAIL (`Cannot find module '../../../policies/is-super-admin'`, `.../controllers/personal-data`).

- [ ] **Step 3: Roles, the policy check, the policy**

`src/club/admin-actor.ts`: change `function adminIdFrom(` to `export function adminIdFrom(` (no other change).

`src/club/personal-data/roles.ts`:

```ts
/** The Super Admin role (3C spec 6). Pure: the admin bundle imports it to hide Super Admin actions; the policy is the authority. */
export const SUPER_ADMIN_CODE = 'strapi-super-admin';

type Raw = Record<string, unknown>;
const isRaw = (v: unknown): v is Raw => !!v && typeof v === 'object';

export function hasSuperAdminRole(user: unknown): boolean {
  const roles = isRaw(user) ? user.roles : null;
  return Array.isArray(roles) && roles.some((r) => isRaw(r) && r.code === SUPER_ADMIN_CODE);
}

/** Body of GET /admin/users/me: `{ data: <admin user with roles> }`. */
export const superAdminFromMe = (body: unknown): boolean => hasSuperAdminRole(isRaw(body) ? body.data : null);
```

`src/club/personal-data/super-admin.ts`:

```ts
import { adminIdFrom } from '../admin-actor';
import { hasSuperAdminRole } from './roles';

/** The parts of Strapi the check needs; `Core.Strapi` satisfies it. */
export type RoleStrapi = {
  config: { get: (key: string) => unknown };
  db: { query: (uid: 'admin::user') => { findOne: (args: { where: { id: unknown }; populate: string[] }) => Promise<unknown> } };
};

/** Same JWT check as `global::is-admin`, then the admin user with roles must hold `strapi-super-admin`. Never throws. */
export async function isSuperAdminRequest(authorization: string | undefined, strapi: RoleStrapi): Promise<boolean> {
  try {
    const id = adminIdFrom(authorization, strapi.config.get('admin.auth.secret'));
    if (id === null || id === undefined) return false;
    return hasSuperAdminRole(await strapi.db.query('admin::user').findOne({ where: { id }, populate: ['roles'] }));
  } catch {
    return false;
  }
}
```

`src/policies/is-super-admin.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { isSuperAdminRequest } from '../club/personal-data/super-admin';

type PolicyContext = { request?: { header?: { authorization?: string } } };

/** Global policy `global::is-super-admin` (3C spec 6): a valid admin JWT whose admin has the Super Admin role; otherwise 403. */
export default async (policyContext: PolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }): Promise<boolean> =>
  isSuperAdminRequest(policyContext.request?.header?.authorization, strapi);
```

If `tsc` does not accept `Core.Strapi` as `RoleStrapi` (the generic `db.query`), pass `strapi as unknown as RoleStrapi` at this one call.

- [ ] **Step 4: Contexts and the startup sweep**

`src/club/personal-data/http.ts`:

```ts
import { readFile } from 'node:fs/promises';
import type { Core } from '@strapi/strapi';
import type { AdminCtx } from '../admin-http';
import { clubStore, serviceContext } from '../athletes/http';
import { deleteRegistrationDocuments, listRegistrationDocuments } from '../documents';
import type { AnonymizeContext } from './anonymize-service';
import type { ExportContext, ExportDocument } from './export-service';
import { sweepAnonymizedFolders } from './sweep';

async function storedDocuments(strapi: Core.Strapi, registrationId: string): Promise<ExportDocument[]> {
  const docs = await listRegistrationDocuments(strapi, registrationId);
  return Promise.all(docs.map(async (d) => ({ kind: d.kind, fileName: d.fileName, data: await readFile(d.path) })));
}

export async function anonymizeContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<AnonymizeContext> {
  return { ...(await serviceContext(strapi, ctx)), removeFiles: (id) => deleteRegistrationDocuments(strapi, id), now: () => new Date() };
}

export async function exportContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<ExportContext> {
  return { ...(await serviceContext(strapi, ctx)), storedDocuments: (id) => storedDocuments(strapi, id), now: () => new Date() };
}

/** Startup (3C spec 4): removes PDF folders an anonymization could not delete. Never blocks or fails the start. */
export function startPersonalDataSweep(strapi: Core.Strapi): void {
  const log = (message: string) => strapi.log.error(message);
  void sweepAnonymizedFolders(clubStore(strapi), (id) => deleteRegistrationDocuments(strapi, id), log)
    .then((n) => {
      if (n) strapi.log.info(`[personal-data] startup sweep: ${n} registration folder(s) of anonymized athletes checked`);
    })
    .catch((err) => log(`[personal-data] startup sweep failed: ${err instanceof Error ? err.message : String(err)}`));
}
```

`src/index.ts`: add `import { startPersonalDataSweep } from './club/personal-data/http';` under the other imports, and in `bootstrap`, right after `await normalizeNavigationPages(strapi);`:

```ts
    // 3C: PDF folders of anonymized athletes' registrations that could not be deleted at the time.
    startPersonalDataSweep(strapi);
```

- [ ] **Step 5: Controller and routes**

`src/api/club/controllers/personal-data.ts`:

```ts
import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { clubStore, serviceContext } from '../../../club/athletes/http';
import { readAnonymizeIds } from '../../../club/personal-data/anonymize-plan';
import { anonymizeAthlete, anonymizeAthletes } from '../../../club/personal-data/anonymize-service';
import { exportAthleteData } from '../../../club/personal-data/export-service';
import { zipHeaders } from '../../../club/personal-data/export-zip';
import { anonymizeContext, exportContext } from '../../../club/personal-data/http';
import { hideInactiveReview, inactiveSummary } from '../../../club/personal-data/review';

type FileCtx = AdminCtx & { set(headers: Record<string, string>): void };

/** Personal data (3C): export (any admin), anonymize and hide the yearly review (Super Admin, routes/05-athletes.ts). */
export default {
  async export(ctx: FileCtx) {
    const result = await exportAthleteData(await exportContext(strapi, ctx), ctx.params.documentId ?? '');
    if (result.ok === false) return refuseWith(ctx, result.status, result.error);
    ctx.set(zipHeaders(result.data.fileName));
    ctx.body = Buffer.from(result.data.data);
  },

  async anonymize(ctx: AdminCtx) {
    respond(ctx, await anonymizeAthlete(await anonymizeContext(strapi, ctx), ctx.params.documentId ?? ''));
  },

  async anonymizeMany(ctx: AdminCtx) {
    const ids = readAnonymizeIds(ctx.request.body);
    if (!ids) return refuseWith(ctx, 400, ADMIN_ERRORS.invalid);
    respond(ctx, await anonymizeAthletes(await anonymizeContext(strapi, ctx), ids));
  },

  async inactiveSummary(ctx: AdminCtx) {
    ctx.body = { data: await inactiveSummary(clubStore(strapi), new Date()) };
  },

  async hideReview(ctx: AdminCtx) {
    respond(ctx, await hideInactiveReview(await serviceContext(strapi, ctx), new Date()));
  },
};
```

`src/api/club/routes/05-athletes.ts` (whole file):

```ts
/**
 * Admin API of Sportivi (spec 5, 6) and personal data (3C). Content-api routes (under /api) with auth off and the
 * `global::is-admin` policy; anonymizing and hiding the yearly review need `global::is-super-admin` (3C spec 6).
 * Fixed paths (search, merge, by-profile, inactive-summary, anonymize) come before `/club/athletes/:documentId`.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };
const superAdminGuard = { auth: false, policies: ['global::is-super-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/athletes', handler: 'athletes.list', config: adminGuard },
    { method: 'GET', path: '/club/athletes/search', handler: 'athletes.search', config: adminGuard },
    { method: 'GET', path: '/club/athletes/by-profile/:profileId', handler: 'athletes.byProfile', config: adminGuard },
    { method: 'POST', path: '/club/athletes', handler: 'athletes.add', config: adminGuard },
    { method: 'GET', path: '/club/athletes/merge-preview', handler: 'athletes.mergePreview', config: adminGuard },
    { method: 'POST', path: '/club/athletes/merge', handler: 'athletes.merge', config: adminGuard },
    { method: 'GET', path: '/club/athletes/inactive-summary', handler: 'personal-data.inactiveSummary', config: adminGuard },
    { method: 'POST', path: '/club/athletes/inactive-summary/hide', handler: 'personal-data.hideReview', config: superAdminGuard },
    { method: 'POST', path: '/club/athletes/anonymize', handler: 'personal-data.anonymizeMany', config: superAdminGuard },
    { method: 'POST', path: '/club/athlete-duplicates/:pairId/dismiss', handler: 'athletes.dismissDuplicate', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/history', handler: 'athletes.history', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/export', handler: 'personal-data.export', config: adminGuard },
    { method: 'POST', path: '/club/athletes/:documentId/anonymize', handler: 'personal-data.anonymize', config: superAdminGuard },
    { method: 'GET', path: '/club/athletes/:documentId', handler: 'athletes.record', config: adminGuard },
    { method: 'PUT', path: '/club/athletes/:documentId', handler: 'athletes.update', config: adminGuard },
    { method: 'POST', path: '/club/athletes/:documentId/profile', handler: 'athletes.createProfile', config: adminGuard },
    { method: 'PUT', path: '/club/athletes/:documentId/profile/visibility', handler: 'athletes.profileVisibility', config: adminGuard },
    { method: 'POST', path: '/club/athletes/:documentId/status', handler: 'athletes.status', config: adminGuard },
    { method: 'DELETE', path: '/club/athletes/:documentId', handler: 'athletes.remove', config: adminGuard },
  ],
};
```

- [ ] **Step 6: Run the tests and the checks**

Run: `npx vitest run src/club/personal-data/__tests__/super-admin.test.ts src/club/__tests__/athlete-routes.test.ts src/club/__tests__/admin-actor.test.ts`, `npx vitest run`, `npx tsc --noEmit`
Expected: PASS, PASS, zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/club/admin-actor.ts src/club/personal-data/roles.ts src/club/personal-data/super-admin.ts src/club/personal-data/http.ts src/policies/is-super-admin.ts src/api/club/controllers/personal-data.ts src/api/club/routes/05-athletes.ts src/index.ts src/club/__tests__/athlete-routes.test.ts src/club/personal-data/__tests__/super-admin.test.ts
git commit -m "feat(personal-data): super admin policy, export and anonymize routes, startup sweep"
```

---

### Task 11: Admin record: "Exportă datele", "Anonimizează", role gating, read-only record

**Files:**
- Create: `src/club/sportivi/personal-data-view.ts`
- Modify: `src/club/sportivi/record-view.ts` (`isReadOnlyRecord`, `recordSubline`, `recordTabs`), `src/club/sportivi/routes.ts` (`inactiveListTo`, `wantsInactiveList`)
- Create: `src/admin/dashboard/sportivi/useSuperAdmin.ts`, `src/admin/dashboard/sportivi/AnonymizeDialog.tsx`
- Modify: `src/admin/dashboard/sportivi/api.ts`, `RecordMenu.tsx` (whole file), `AthleteRecordPage.tsx` (`HeaderProps`, `HeaderActions`, `AthleteRecordPage`), `DateTab.tsx` (`DateView`, `DateTab`), `styles.ts`
- Modify: `src/club/sportivi/__tests__/admin-sportivi.test.ts:268` (the menu string)
- Test: `src/club/sportivi/__tests__/record-3c.test.ts`

**Interfaces:**
- Consumes: Task 10 routes and `superAdminFromMe`; Task 1 `PERSONAL_DATA_COPY`, `STATUS_WORDS.anonimizat`; Task 3 `BulkAnonymizeResult`; Task 2 `InactiveSummary`; existing `menuItems`, `MenuKey`, `RECORD_COPY` (`record-view.ts`), `downloadPdf` (`inscrieri/downloadPdf.ts`), `useStableClient` (`inscrieri/useClient.ts`), `getFetchClient` (`@strapi/admin/strapi-admin`), `ConfirmDialog`, `MenuButton`.
- Produces:
  - `record-view.ts`: `isReadOnlyRecord(r: Pick<AthleteRecord, 'status'>): boolean`; `recordTabs` gives only `date` and `istoric` for an anonymized record; `recordSubline` gives only the main group for it.
  - `personal-data-view.ts`: `type RecordMenuKey = MenuKey | 'export' | 'anonymize'`, `type RecordMenuItem = { key: RecordMenuKey; label: string }`, `recordMenuItems(status: AthleteStatus, superAdmin: boolean): RecordMenuItem[]`, `anonymizeLines(): string[]`, `EXPORT_FALLBACK_NAME = 'date.zip'`, `exportUrl(documentId: string): string`
  - `routes.ts`: `INACTIVE_PARAM = 'inactivi'`, `inactiveListTo = '/plugins/edusport-sportivi?inactivi=1'`, `wantsInactiveList(search: string): boolean`
  - `api.ts` (`SportiviApi`): `anonymize(id: string): Promise<{ documentId: string }>`, `anonymizeMany(documentIds: string[]): Promise<BulkAnonymizeResult>`, `inactiveSummary(): Promise<InactiveSummary>`, `hideInactiveReview(): Promise<InactiveSummary>`
  - `useIsSuperAdmin(): boolean` (`src/admin/dashboard/sportivi/useSuperAdmin.ts`; false until `/admin/users/me` answers)
  - `AnonymizeDialog({ open, count, busy, error, onCancel, onConfirm })`: `count` null is the single-record title, a number is the bulk title.

Behaviour (spec 3, 4, 6): the "..." menu reads "Marchează inactiv/activ", "Unește cu alt sportiv", "Exportă datele", "Anonimizează" (Super Admin only), "Șterge sportivul". "Exportă datele" downloads through the detached client (`getFetchClient`), toast "Datele au fost exportate.", or the shared error. "Anonimizează" opens the confirmation (title, three lines, "Anonimizează", busy "Se anonimizează..."), then toast "1 sportiv anonimizat." and the record reloads read-only: badge "Anonimizat", no "...", no "Editează", tabs Date and Istoric.

- [ ] **Step 1: Write the failing test**

`src/club/sportivi/__tests__/record-3c.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AthleteRecord } from '../../athletes/api-types';
import { EXPORT_FALLBACK_NAME, anonymizeLines, exportUrl, recordMenuItems } from '../personal-data-view';
import { isReadOnlyRecord, recordSubline, recordTabs } from '../record-view';
import { inactiveListTo, wantsInactiveList } from '../routes';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', '..', 'admin', 'dashboard', p), 'utf8');
const labels = (status: AthleteRecord['status'], superAdmin: boolean) => recordMenuItems(status, superAdmin).map((i) => i.label);

const RECORD = {
  documentId: 'a9', fields: { name: 'Sportiv anonimizat', birthDate: null, contactName: null, phone: null, email: null }, missing: [], status: 'anonimizat',
  dataIncomplete: false, header: { birthDate: null, mainGroup: 'Începători' }, season: null, acs: { seasonLabel: null, state: 'nu' },
  registrations: [], documents: [], profile: null, duplicates: [], historyCount: 4,
} as AthleteRecord;

describe('record menu (3C spec 3, 4, 6)', () => {
  it('export for every admin, anonymize only for a Super Admin, nothing on an anonymized record', () => {
    expect(labels('activ', false)).toEqual(['Marchează inactiv', 'Unește cu alt sportiv', 'Exportă datele', 'Șterge sportivul']);
    expect(labels('activ', true)).toEqual(['Marchează inactiv', 'Unește cu alt sportiv', 'Exportă datele', 'Anonimizează', 'Șterge sportivul']);
    expect(labels('inactiv', true)[0]).toBe('Marchează activ');
    expect(recordMenuItems('anonimizat', true)).toEqual([]);
  });

  it('the confirmation lines and the export address', () => {
    expect(anonymizeLines()).toEqual([
      'Se șterg: numele, data nașterii, contactul, telefonul, e-mailul, notele, datele din înscrieri, documentele PDF, adresele din coada de e-mail, valorile vechi din Istoric și profilul public.',
      'Rămân: grupele pe sezoane, statusul A.C.S. și numărul de înscrieri.',
      'Acțiunea nu poate fi anulată.',
    ]);
    expect(exportUrl('a b')).toBe('/api/club/athletes/a%20b/export');
    expect(EXPORT_FALLBACK_NAME).toBe('date.zip');
  });

  it('an anonymized record: read-only, Date and Istoric only, sub-line without "data nașterii lipsește"', () => {
    expect(isReadOnlyRecord(RECORD)).toBe(true);
    expect(isReadOnlyRecord({ status: 'inactiv' })).toBe(false);
    expect(recordTabs(RECORD).map((t) => t.id)).toEqual(['date', 'istoric']);
    expect(recordSubline(RECORD)).toBe('Începători');
  });

  it('the dashboard link to the inactivity list', () => {
    expect(inactiveListTo).toBe('/plugins/edusport-sportivi?inactivi=1');
    expect(wantsInactiveList('?inactivi=1')).toBe(true);
    expect(wantsInactiveList('?adauga=1')).toBe(false);
  });
});

describe('record wiring (source, 3C spec 8)', () => {
  it('the menu: items by role, export through the detached client, the anonymize confirmation', () => {
    const menu = read('sportivi/RecordMenu.tsx');
    for (const s of [
      'recordMenuItems(record.status, superAdmin)', 'downloadPdf(getFetchClient().get, exportUrl(id), EXPORT_FALLBACK_NAME)', 'PERSONAL_DATA_COPY.exported',
      'adminToast.error(ADMIN_ERRORS.failed)', '<AnonymizeDialog', 'await api.anonymize(record.documentId)', 'PERSONAL_DATA_COPY.done(1)',
      'RECORD_COPY.menu.button', 'RECORD_COPY.inactiveDialog.title', 'RECORD_COPY.deleteDialog.message(', "api.setStatus(record.documentId, 'inactiv')",
      'navigate(SPORTIVI_PATH, { replace: true })',
    ]) expect(menu, s).toContain(s);
  });

  it('the confirmation copy comes from the copy module', () => {
    const dialog = read('sportivi/AnonymizeDialog.tsx');
    for (const s of ['PERSONAL_DATA_COPY.bulkTitle(count)', 'c.title', 'anonymizeLines()', 'confirmLabel={c.confirm}', 'busyLabel={c.busy}']) expect(dialog, s).toContain(s);
  });

  it('role gating reads /admin/users/me; the anonymized record has no menu and no "Editează"', () => {
    expect(read('sportivi/useSuperAdmin.ts')).toContain("client.get('/admin/users/me')");
    expect(read('sportivi/useSuperAdmin.ts')).toContain('superAdminFromMe(r.data)');
    const page = read('sportivi/AthleteRecordPage.tsx');
    for (const s of ['useIsSuperAdmin()', '!isReadOnlyRecord(record) && <RecordMenu', 'superAdmin={superAdmin}', 'STATUS_WORDS[record.status]']) expect(page, s).toContain(s);
    const date = read('sportivi/DateTab.tsx');
    expect(date).toContain('onEdit={readOnly ? null : edit.start}');
    expect(date).toContain('{!readOnly && <p className="ui-hint">');
  });

  it('the API client calls the 3C routes', () => {
    const api = read('sportivi/api.ts');
    for (const s of ['/anonymize`, {})', '`${BASE}/anonymize`, { documentIds }', '`${BASE}/inactive-summary`', '`${BASE}/inactive-summary/hide`']) expect(api, s).toContain(s);
  });
});
```

In `src/club/sportivi/__tests__/admin-sportivi.test.ts` line 268 replace `'menuItems(record.status)'` with `'recordMenuItems(record.status, superAdmin)'`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/record-3c.test.ts`
Expected: FAIL (`Cannot find module '../personal-data-view'`).

- [ ] **Step 3: Pure rules**

`src/club/sportivi/record-view.ts`: after `RECORD_COPY` add

```ts
/** An anonymized record is read-only (3C spec 4): no "Editează", no "..." menu, only Date and Istoric. */
export const isReadOnlyRecord = (r: Pick<AthleteRecord, 'status'>): boolean => r.status === 'anonimizat';
```

replace `recordSubline` and `recordTabs`:

```ts
/** "<data nașterii>, <grupa principală>", or "data nașterii lipsește" (spec 6.1; no middle dot, gaps #1); an anonymized record: the group only. */
export function recordSubline(r: AthleteRecord): string {
  if (isReadOnlyRecord(r)) return r.header.mainGroup ?? '';
  return [r.header.birthDate ?? RECORD_COPY.noBirthDate, r.header.mainGroup].filter(Boolean).join(', ');
}

export function recordTabs(r: AthleteRecord): { id: RecordTab; label: string; count?: number }[] {
  const tabs: { id: RecordTab; label: string; count?: number }[] = [
    { id: 'date', label: RECORD_COPY.tabs.date },
    { id: 'profil', label: RECORD_COPY.tabs.profil },
    { id: 'documente', label: RECORD_COPY.tabs.documente },
    { id: 'istoric', label: RECORD_COPY.tabs.istoric, count: r.historyCount },
  ];
  return isReadOnlyRecord(r) ? tabs.filter((t) => t.id === 'date' || t.id === 'istoric') : tabs;
}
```

`src/club/sportivi/personal-data-view.ts`:

```ts
import type { AthleteStatus } from '../athlete-data';
import { PERSONAL_DATA_COPY as C } from '../personal-data/copy';
import { menuItems, type MenuKey } from './record-view';

/** Rules of the 3C admin screens (record menu, confirmation, export). Pure: the admin bundle imports it. */
export type RecordMenuKey = MenuKey | 'export' | 'anonymize';
export type RecordMenuItem = { key: RecordMenuKey; label: string };

/** "..." menu (spec 6.1 + 3C spec 3, 4): export for every admin, anonymize only for a Super Admin, none when anonymized. */
export function recordMenuItems(status: AthleteStatus, superAdmin: boolean): RecordMenuItem[] {
  if (status === 'anonimizat') return [];
  const [statusItem, merge, remove] = menuItems(status);
  const data: RecordMenuItem[] = [{ key: 'export', label: C.menu.export }];
  if (superAdmin) data.push({ key: 'anonymize', label: C.menu.anonymize });
  return [statusItem, merge, ...data, remove];
}

/** The confirmation's short lines (spec 4): what is removed, what stays, no undo. */
export const anonymizeLines = (): string[] => [C.dialog.removed, C.dialog.kept, C.dialog.final];

export const EXPORT_FALLBACK_NAME = 'date.zip';
export const exportUrl = (documentId: string): string => `/api/club/athletes/${encodeURIComponent(documentId)}/export`;
```

`src/club/sportivi/routes.ts`, after `wantsAddAthlete`:

```ts
export const INACTIVE_PARAM = 'inactivi';

/** The Sportivi list with "Inactivi de peste N ani" on (dashboard notice "Vezi lista", 3C spec 5). */
export const inactiveListTo = `${SPORTIVI_PATH}?${INACTIVE_PARAM}=1`;

export const wantsInactiveList = (search: string): boolean => new URLSearchParams(search).get(INACTIVE_PARAM) === '1';
```

- [ ] **Step 4: API client and the role hook**

`src/admin/dashboard/sportivi/api.ts`: add the imports

```ts
import type { BulkAnonymizeResult } from '../../../club/personal-data/anonymize-plan';
import type { InactiveSummary } from '../../../club/personal-data/settings';
```

and inside the returned object, after `dismissDuplicate`:

```ts
      anonymize: (id: string) => post<{ documentId: string }>(`${one(id)}/anonymize`, {}),
      anonymizeMany: (documentIds: string[]) => post<BulkAnonymizeResult>(`${BASE}/anonymize`, { documentIds }),
      inactiveSummary: () => get<InactiveSummary>(`${BASE}/inactive-summary`),
      hideInactiveReview: () => post<InactiveSummary>(`${BASE}/inactive-summary/hide`, {}),
```

`src/admin/dashboard/sportivi/useSuperAdmin.ts`:

```ts
import * as React from 'react';
import { superAdminFromMe } from '../../../club/personal-data/roles';
import { useStableClient } from '../inscrieri/useClient';

/** Hides Super Admin actions (3C spec 6); the server policy is the authority. False until /admin/users/me answers. */
export function useIsSuperAdmin(): boolean {
  const client = useStableClient();
  const [superAdmin, setSuperAdmin] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    client.get('/admin/users/me').then((r) => {
      if (!off) setSuperAdmin(superAdminFromMe(r.data));
    }).catch(() => undefined);
    return () => {
      off = true;
    };
  }, [client]);
  return superAdmin;
}
```

- [ ] **Step 5: The confirmation and the menu**

`src/admin/dashboard/sportivi/AnonymizeDialog.tsx`:

```tsx
import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog';
import { PERSONAL_DATA_COPY } from '../../../club/personal-data/copy';
import { anonymizeLines } from '../../../club/sportivi/personal-data-view';

type Props = { open: boolean; count: number | null; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void };

/** "Anonimizezi datele sportivului?" (3C spec 4), or the bulk title for k athletes (spec 5); the same three lines; no undo. */
export function AnonymizeDialog({ open, count, busy, error, onCancel, onConfirm }: Props) {
  const c = PERSONAL_DATA_COPY.dialog;
  const lines = <span className="spv-lines">{anonymizeLines().map((line) => <span key={line}>{line}</span>)}</span>;
  return (
    <ConfirmDialog
      open={open} title={count === null ? c.title : PERSONAL_DATA_COPY.bulkTitle(count)} message={lines}
      confirmLabel={c.confirm} busyLabel={c.busy} busy={busy} error={error} onCancel={onCancel} onConfirm={onConfirm}
    />
  );
}
```

`src/admin/dashboard/sportivi/RecordMenu.tsx` (whole file):

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { getFetchClient } from '@strapi/admin/strapi-admin';
import { adminToast } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import { MenuButton } from '../SubmissionTable';
import { downloadPdf } from '../inscrieri/downloadPdf';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { PERSONAL_DATA_COPY } from '../../../club/personal-data/copy';
import { requestErrorText } from '../../../club/registration-panel';
import { EXPORT_FALLBACK_NAME, exportUrl, recordMenuItems, type RecordMenuItem, type RecordMenuKey } from '../../../club/sportivi/personal-data-view';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import { SPORTIVI_PATH } from '../../../club/sportivi/routes';
import { AnonymizeDialog } from './AnonymizeDialog';
import type { SportiviApi } from './api';

type Props = { record: AthleteRecord; api: SportiviApi; reload: () => Promise<void>; onMerge: () => void; superAdmin: boolean };
type Dialog = 'inactive' | 'delete' | 'anonymize' | null;
type SetBusy = (b: boolean) => void;

/** "Marchează activ": applied at once, no dialog; `setBusy` keeps the trigger disabled for the round trip. */
async function activate(api: SportiviApi, id: string, reload: () => Promise<void>, setBusy: SetBusy): Promise<void> {
  setBusy(true);
  try {
    await api.setStatus(id, 'activ');
    await reload();
  } catch (err) {
    adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
  } finally {
    setBusy(false);
  }
}

/** "Exportă datele" (3C spec 3): the detached client, so closing the menu never cancels the download. */
async function exportData(id: string, setBusy: SetBusy): Promise<void> {
  setBusy(true);
  try {
    await downloadPdf(getFetchClient().get, exportUrl(id), EXPORT_FALLBACK_NAME);
    adminToast.success(PERSONAL_DATA_COPY.exported);
  } catch {
    adminToast.error(ADMIN_ERRORS.failed);
  } finally {
    setBusy(false);
  }
}

function MenuLabel() {
  return (
    <>
      <span aria-hidden="true">...</span>
      <span className="ui-sr">{RECORD_COPY.menu.button}</span>
    </>
  );
}

const isDanger = (key: RecordMenuKey): boolean => key === 'delete' || key === 'anonymize';

function MenuItems({ items, onPick }: { items: RecordMenuItem[]; onPick: (key: RecordMenuKey) => void }) {
  return (
    <>
      {items.map((item) => (
        <button key={item.key} type="button" role="menuitem" className={isDanger(item.key) ? 'spv-danger' : undefined} onClick={() => onPick(item.key)}>
          {item.label}
        </button>
      ))}
    </>
  );
}

type DialogsProps = Omit<Props, 'onMerge' | 'superAdmin'> & { dialog: Dialog; onClose: () => void };
type ConfirmState = { open: boolean; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void };

/** Busy/error/cancel shared by whichever confirmation is open (only one at a time). */
function useConfirmRunner(onClose: () => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onClose();
    } catch (err) {
      setError(requestErrorText(err, ADMIN_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => {
    if (busy) return;
    setError(null);
    onClose();
  };
  return { busy, error, run, cancel };
}

/** "Marchezi sportivul ca inactiv?" (spec Open 3). */
function InactiveDialog({ open, busy, error, onCancel, onConfirm }: ConfirmState) {
  const copy = RECORD_COPY.inactiveDialog;
  return (
    <ConfirmDialog
      open={open} title={RECORD_COPY.inactiveDialog.title} message={copy.message} confirmLabel={copy.confirm} busyLabel={copy.confirm}
      tone="default" busy={busy} error={error} onCancel={onCancel} onConfirm={onConfirm}
    />
  );
}

/** "Ștergi sportivul?" (spec 6.6): default ConfirmDialog tone and "Șterge definitiv" label. */
function DeleteDialog({ open, busy, error, onCancel, onConfirm, name }: ConfirmState & { name: string }) {
  return (
    <ConfirmDialog
      open={open} title={RECORD_COPY.deleteDialog.title} message={RECORD_COPY.deleteDialog.message(name)}
      busy={busy} error={error} onCancel={onCancel} onConfirm={onConfirm}
    />
  );
}

/** "Marchează inactiv", "Șterge sportivul" (spec Open 3, 6.6) and "Anonimizează" (3C spec 4) confirmations. */
function RecordDialogs({ record, api, reload, dialog, onClose }: DialogsProps) {
  const navigate = useNavigate();
  const { busy, error, run, cancel } = useConfirmRunner(onClose);
  const anonymize = async () => {
    await api.anonymize(record.documentId);
    adminToast.success(PERSONAL_DATA_COPY.done(1));
    await reload();
  };
  return (
    <>
      <InactiveDialog
        open={dialog === 'inactive'} busy={busy} error={error} onCancel={cancel}
        onConfirm={() => void run(async () => { await api.setStatus(record.documentId, 'inactiv'); await reload(); })}
      />
      <DeleteDialog
        open={dialog === 'delete'} busy={busy} error={error} onCancel={cancel} name={record.fields.name ?? ''}
        onConfirm={() => void run(async () => { await api.remove(record.documentId); navigate(SPORTIVI_PATH, { replace: true }); })}
      />
      <AnonymizeDialog open={dialog === 'anonymize'} count={null} busy={busy} error={error} onCancel={cancel} onConfirm={() => void run(anonymize)} />
    </>
  );
}

/** Header "..." menu (spec 6.1, gaps #8, 3C spec 3, 4). */
export function RecordMenu({ record, api, reload, onMerge, superAdmin }: Props) {
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [busy, setBusy] = React.useState(false);
  const pick = (key: RecordMenuKey) => {
    if (busy) return;
    setOpen(false);
    if (key === 'merge') onMerge();
    else if (key === 'export') void exportData(record.documentId, setBusy);
    else if (key === 'delete' || key === 'anonymize') setDialog(key);
    else if (record.status === 'inactiv') void activate(api, record.documentId, reload, setBusy);
    else setDialog('inactive');
  };
  return (
    <>
      <MenuButton label={<MenuLabel />} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false} disabled={busy}>
        <MenuItems items={recordMenuItems(record.status, superAdmin)} onPick={pick} />
      </MenuButton>
      <RecordDialogs record={record} api={api} reload={reload} dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
```

The test looks for `exportUrl(id)`: in `exportData` the parameter is named `id`, keep it so.

- [ ] **Step 6: Record page and Date tab**

`src/admin/dashboard/sportivi/AthleteRecordPage.tsx`: add the imports

```tsx
import { isReadOnlyRecord } from '../../../club/sportivi/record-view';
import { useIsSuperAdmin } from './useSuperAdmin';
```

(add `isReadOnlyRecord` to the existing `record-view` import instead of a second line), replace `HeaderProps` and `HeaderActions`:

```tsx
type HeaderProps = { record: AthleteRecord; api: SportiviApi; loaded: Loaded; onMerge: () => void; superAdmin: boolean };

/** Badges and the "..." menu beside the name. Needs decision 12, option B: "Inactiv" while inactive; 3C: "Anonimizat", read-only, no menu. */
function HeaderActions({ record, api, loaded, onMerge, superAdmin }: HeaderProps) {
  const badge = record.status === 'inactiv' || record.status === 'anonimizat';
  return (
    <div className="spv-head-acts">
      {record.dataIncomplete && <StatusBadge tone="warning">{RECORD_COPY.incomplete}</StatusBadge>}
      {badge && <StatusBadge tone="neutral">{STATUS_WORDS[record.status]}</StatusBadge>}
      {!isReadOnlyRecord(record) && <RecordMenu record={record} api={api} reload={loaded.reload} onMerge={onMerge} superAdmin={superAdmin} />}
    </div>
  );
}
```

and in `AthleteRecordPage`, after `const phone = useIsPhone();` add `const superAdmin = useIsSuperAdmin();` and change the `actions` line to:

```tsx
  const actions = record ? <HeaderActions record={record} api={api} loaded={loaded} onMerge={() => setMerge({ otherId: null })} superAdmin={superAdmin} /> : null;
```

`src/admin/dashboard/sportivi/DateTab.tsx`: add `isReadOnlyRecord` to the `record-view` import; `DateView` takes `onEdit: (() => void) | null` and shows the button only with it:

```tsx
function DateView({ record, onEdit }: { record: AthleteRecord; onEdit: (() => void) | null }) {
  return (
    <dl className="spv-fields">
      {fieldRows(record).map((row, i) => (
        <div key={row.field} className="spv-field">
          <dt className="spv-label">
            <span>{row.label}</span>
            {i === 0 && onEdit && <button type="button" id={EDIT_ID} className="spv-link" onClick={onEdit}>{RECORD_COPY.edit}</button>}
          </dt>
          <dd className="spv-value">{row.missing && <span className="spv-missing">{RECORD_COPY.missing}</span>}{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

and in `DateTab`, after `const edit = useDateEdit(props);` add `const readOnly = isReadOnlyRecord(props.record);`, then:

```tsx
        <DateView record={props.record} onEdit={readOnly ? null : edit.start} />
```

```tsx
      {!readOnly && <p className="ui-hint">{RECORD_COPY.requiredHint}</p>}
```

`src/admin/dashboard/sportivi/styles.ts`: after the line `.ui-root.spv-menu button.spv-danger{color:var(--theme-danger)}` add

```
.ui-root .spv-lines span{display:block}
.ui-root .spv-lines span+span{margin-top:6px}
```

- [ ] **Step 7: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/record-3c.test.ts src/club/sportivi/__tests__/admin-sportivi.test.ts src/club/sportivi/__tests__/record-view.test.ts`, `npx vitest run`, `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`
Expected: PASS, PASS, zero errors in both projects, checker exit 0. If `tsc -p src/admin` refuses `getFetchClient().get` as the `downloadPdf` getter, widen `downloadPdf`'s `Get` type in `inscrieri/downloadPdf.ts` to `Pick<ReturnType<typeof getFetchClient>, 'get'>['get']` (same function shape); do not cast.

- [ ] **Step 8: Commit**

```bash
git add src/club/sportivi/personal-data-view.ts src/club/sportivi/record-view.ts src/club/sportivi/routes.ts src/admin/dashboard/sportivi src/admin/dashboard/inscrieri/downloadPdf.ts src/club/sportivi/__tests__/record-3c.test.ts src/club/sportivi/__tests__/admin-sportivi.test.ts
git commit -m "feat(sportivi): export and anonymize in the record menu, read-only anonymized record"
```

---

### Task 12: Admin list: "Date personale" filter, status "Anonimizat", checkboxes and the bulk bar

**Files:**
- Modify: `src/club/sportivi/list-view.ts` (`ListFilters`, `FILTER_KEYS`, `EMPTY_FILTERS`, `STATUS_OPTIONS`, `listQueryString`, `filterSections`, new `INACTIVE`, `inactiveShown`, `showInactive`)
- Modify: `src/club/sportivi/personal-data-view.ts` (selection and bulk helpers)
- Modify: `src/admin/dashboard/sportivi/useAthleteList.ts` (`reload`)
- Create: `src/admin/dashboard/sportivi/useSelection.ts`, `src/admin/dashboard/sportivi/BulkAnonymizeBar.tsx`
- Modify: `src/admin/dashboard/sportivi/SportiviList.tsx`, `AthleteTable.tsx`, `AthleteCards.tsx` (whole files), `styles.ts`
- Modify: `src/club/sportivi/__tests__/list-view.test.ts:112,119`, `src/club/sportivi/__tests__/admin-sportivi.test.ts:185`
- Test: `src/club/sportivi/__tests__/list-3c.test.ts`

**Interfaces:**
- Consumes: Task 8 (`inactive=true`, `status=anonimizat`, `AthleteListPage.retentionYears`); Task 11 `useIsSuperAdmin`, `AnonymizeDialog`, `SportiviApi.anonymizeMany`, `wantsInactiveList`; Task 1 `PERSONAL_DATA_COPY`; Task 2 `DEFAULT_RETENTION_YEARS`; Task 3 `MAX_BULK`, `BulkAnonymizeResult`; `Checkbox` (`src/admin/ui`).
- Produces:
  - `list-view.ts`: `ListFilters.personal: string[]`, `INACTIVE = 'inactive'`, `inactiveShown(s: ListState): boolean`, `showInactive(s: ListState): ListState`; status option "Anonimizat"; section "Date personale" with "Inactivi de peste N ani".
  - `personal-data-view.ts`: `toggled(ids: ReadonlySet<string>, id: string): Set<string>`, `allSelected(ids: ReadonlySet<string>, rowIds: string[]): boolean`, `toggledAll(ids: ReadonlySet<string>, rowIds: string[]): Set<string>`, `chunks(ids: string[], size?: number): string[][]`, `addResults(a: BulkAnonymizeResult, b: BulkAnonymizeResult): BulkAnonymizeResult`, `bulkToast(r: BulkAnonymizeResult): string`, `selectionOn(inactiveFilterOn: boolean, superAdmin: boolean): boolean`
  - `AthleteList.reload(): void`; `type Selection = { ids: ReadonlySet<string>; toggle(id: string): void; toggleAll(rowIds: string[]): void; done(): void }`; `useSelection(list, superAdmin): Selection | null`; `useInactiveLink(list, search): void`.

Behaviour (spec 5): with "Inactivi de peste N ani" on and a Super Admin, rows and cards get square checkboxes (header "Selectează tot" on desktop); with at least one ticked, a bar shows "Anonimizează (k)"; it opens the confirmation with k and the same lines; the result toast reads "k sportivi anonimizați." plus "Sărite: n." / "Nereușite: n." when not zero; the selection clears and the list reloads. The selection clears whenever the filters, the search or the season change. The dashboard's "Vezi lista" (`?inactivi=1`) opens the list with only that filter.

- [ ] **Step 1: Write the failing test**

`src/club/sportivi/__tests__/list-3c.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AthleteListPage } from '../../athletes/api-types';
import { INACTIVE, INITIAL_LIST_STATE, filterSections, inactiveShown, listQueryString, showInactive, withSection } from '../list-view';
import { addResults, allSelected, bulkToast, chunks, selectionOn, toggled, toggledAll } from '../personal-data-view';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', '..', 'admin', 'dashboard', p), 'utf8');
const page = (retentionYears: number) => ({ retentionYears, options: { sections: [], groups: [] } }) as unknown as AthleteListPage;

describe('list filters (3C spec 5)', () => {
  it('"Date personale" with "Inactivi de peste N ani", N from the page; status gains "Anonimizat"', () => {
    const sections = filterSections(INITIAL_LIST_STATE, page(7));
    const personal = sections.find((s) => s.key === 'personal');
    expect(personal).toMatchObject({ label: 'Date personale', options: [{ value: INACTIVE, label: 'Inactivi de peste 7 ani' }] });
    expect(sections.find((s) => s.key === 'status')?.options.map((o) => o.label)).toEqual(['Nou', 'Activ', 'Inactiv', 'Anonimizat']);
    expect(filterSections(INITIAL_LIST_STATE, null).find((s) => s.key === 'personal')?.options[0].label).toBe('Inactivi de peste 5 ani');
  });

  it('asks the server for inactive=true and status=anonimizat', () => {
    const s = withSection(withSection(INITIAL_LIST_STATE, 'personal', [INACTIVE]), 'status', ['anonimizat']);
    const q = new URLSearchParams(listQueryString(s, 50));
    expect(q.get('inactive')).toBe('true');
    expect(q.get('status')).toBe('anonimizat');
    expect(new URLSearchParams(listQueryString(INITIAL_LIST_STATE, 50)).get('inactive')).toBeNull();
  });

  it('the dashboard link turns on only the inactivity filter', () => {
    const busy = withSection(INITIAL_LIST_STATE, 'acs', ['da']);
    const s = showInactive(busy);
    expect(inactiveShown(s)).toBe(true);
    expect(s.filters.acs).toEqual([]);
    expect(inactiveShown(INITIAL_LIST_STATE)).toBe(false);
  });
});

describe('selection and bulk (3C spec 5)', () => {
  it('checkboxes only for a Super Admin with the inactivity filter on', () => {
    expect(selectionOn(true, true)).toBe(true);
    expect(selectionOn(true, false)).toBe(false);
    expect(selectionOn(false, true)).toBe(false);
  });

  it('ticks one, ticks all on the page, unticks all', () => {
    const one = toggled(new Set(), 'a');
    expect([...one]).toEqual(['a']);
    expect([...toggled(one, 'a')]).toEqual([]);
    const all = toggledAll(one, ['a', 'b']);
    expect([...all].sort()).toEqual(['a', 'b']);
    expect(allSelected(all, ['a', 'b'])).toBe(true);
    expect([...toggledAll(all, ['a', 'b'])]).toEqual([]);
    expect(allSelected(new Set(), [])).toBe(false);
  });

  it('sends at most 200 ids per request and adds the answers', () => {
    const ids = Array.from({ length: 450 }, (_, i) => `id${i}`);
    expect(chunks(ids).map((c) => c.length)).toEqual([200, 200, 50]);
    expect(addResults({ anonymized: 2, skipped: 1, failed: 0 }, { anonymized: 3, skipped: 0, failed: 1 })).toEqual({ anonymized: 5, skipped: 1, failed: 1 });
  });

  it('one toast with the counts that are not zero', () => {
    expect(bulkToast({ anonymized: 3, skipped: 0, failed: 0 })).toBe('3 sportivi anonimizați.');
    expect(bulkToast({ anonymized: 1, skipped: 2, failed: 1 })).toBe('1 sportiv anonimizat. Sărite: 2. Nereușite: 1.');
  });
});

describe('list wiring (source, 3C spec 8)', () => {
  it('the list mounts the selection, the bulk bar and the dashboard link', () => {
    const list = read('sportivi/SportiviList.tsx');
    for (const s of [
      'const selection = useSelection(list, useIsSuperAdmin());', 'useInactiveLink(list, search);',
      '{selection && selection.ids.size > 0 && <BulkAnonymizeBar ids={[...selection.ids]} api={api} done={selection.done} />}',
      '{phone ? <AthleteCards list={list} onOpen={open} selection={selection} /> : <AthleteTable list={list} onOpen={open} selection={selection} />}',
    ]) expect(list, s).toContain(s);
  });

  it('the selection only for a Super Admin with the filter on, cleared on every list change', () => {
    const hook = read('sportivi/useSelection.ts');
    for (const s of ['selectionOn(inactiveShown(list.state), superAdmin)', 'listQueryString(withPage(list.state, 1), 0)', 'wantsInactiveList(search)', 'showInactive(']) {
      expect(hook, s).toContain(s);
    }
  });

  it('the bar: "Anonimizează (k)", the shared confirmation with k, chunks of 200, one toast', () => {
    const bar = read('sportivi/BulkAnonymizeBar.tsx');
    for (const s of ['PERSONAL_DATA_COPY.bulkButton(ids.length)', '<AnonymizeDialog', 'count={ids.length}', 'chunks(ids)', 'bulkToast(result)', 'api.anonymizeMany(part)']) {
      expect(bar, s).toContain(s);
    }
  });

  it('table and cards: square checkboxes, the row click still opens the record', () => {
    const table = read('sportivi/AthleteTable.tsx');
    for (const s of ['<Checkbox', 'aria-label={PERSONAL_DATA_COPY.selectAll}', 'selection.toggleAll(ids)', 'onClick={(e) => e.stopPropagation()}', '<div className="ui-table-wrap">', '<div className="spv-foot">', 'withHeaderSort(state, sortKey)']) {
      expect(table, s).toContain(s);
    }
    const cards = read('sportivi/AthleteCards.tsx');
    for (const s of ['<Checkbox', 'selection.toggle(r.documentId)', '<MissingMarker row={r} card />', 'LIST_COPY.more']) expect(cards, s).toContain(s);
  });
});
```

`src/club/sportivi/__tests__/list-view.test.ts`: line 112 expects the labels `['Secțiune', 'Grupa', 'Membru A.C.S.', 'Profil public', 'Date', 'Status', 'Posibile dubluri', 'Date personale']`; line 119 expects `['Nou', 'Activ', 'Inactiv', 'Anonimizat']`.

`src/club/sportivi/__tests__/admin-sportivi.test.ts` line 185: expect `'{phone ? <AthleteCards list={list} onOpen={open} selection={selection} /> : <AthleteTable list={list} onOpen={open} selection={selection} />}'`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/list-3c.test.ts`
Expected: FAIL (`INACTIVE` is not exported).

- [ ] **Step 3: `list-view.ts`**

Imports, add:

```ts
import { PERSONAL_DATA_COPY } from '../personal-data/copy';
import { DEFAULT_RETENTION_YEARS } from '../personal-data/settings';
```

`ListFilters`: add `personal: string[];` after `duplicates: string[];`. Replace:

```ts
const FILTER_KEYS: readonly FilterKey[] = ['section', 'group', 'acs', 'profile', 'data', 'status', 'duplicates', 'personal'];
export const EMPTY_FILTERS: ListFilters = { section: [], group: [], acs: [], profile: [], data: [], status: [], duplicates: [], personal: [] };
```

```ts
const STATUS_OPTIONS: Choice[] = (['nou', 'activ', 'inactiv', 'anonimizat'] as const).map((value) => ({ value, label: STATUS_WORDS[value] }));
/** "Inactivi de peste N ani" (3C spec 5): the server's `inactive=true`. */
export const INACTIVE = 'inactive';
```

`listQueryString`, after `if (f.duplicates.length) p.set('duplicates', 'true');`:

```ts
  if (f.personal.includes(INACTIVE)) p.set('inactive', 'true');
```

`filterSections`, last entry of the returned array (after "Posibile dubluri"):

```ts
    {
      key: 'personal', label: PERSONAL_DATA_COPY.filterSection, selected: f.personal,
      options: [{ value: INACTIVE, label: PERSONAL_DATA_COPY.inactiveOption(p?.retentionYears ?? DEFAULT_RETENTION_YEARS) }],
    },
```

After `incompleteShown`:

```ts
/** The bulk bar needs the inactivity list on screen (3C spec 5). */
export const inactiveShown = (s: ListState): boolean => s.filters.personal.includes(INACTIVE);
/** Dashboard "Vezi lista": only "Inactivi de peste N ani". */
export const showInactive = (s: ListState): ListState => withSection(clearFilters(s), 'personal', [INACTIVE]);
```

- [ ] **Step 4: Selection helpers**

Append to `src/club/sportivi/personal-data-view.ts`:

```ts
import { MAX_BULK, type BulkAnonymizeResult } from '../personal-data/anonymize-plan';
```

(move this import to the top with the others) and:

```ts
/** Checkboxes and the bulk bar: only a Super Admin, only on the inactivity list (3C spec 5). */
export const selectionOn = (inactiveFilterOn: boolean, superAdmin: boolean): boolean => inactiveFilterOn && superAdmin;

export function toggled(ids: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export const allSelected = (ids: ReadonlySet<string>, rowIds: string[]): boolean => rowIds.length > 0 && rowIds.every((id) => ids.has(id));

/** "Selectează tot": ticks every row shown, or unticks them when all are ticked. */
export function toggledAll(ids: ReadonlySet<string>, rowIds: string[]): Set<string> {
  if (allSelected(ids, rowIds)) return new Set([...ids].filter((id) => !rowIds.includes(id)));
  return new Set([...ids, ...rowIds]);
}

/** The route takes at most 200 ids; a bigger selection goes in turns (decided while planning, item 10). */
export function chunks(ids: string[], size: number = MAX_BULK): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export const addResults = (a: BulkAnonymizeResult, b: BulkAnonymizeResult): BulkAnonymizeResult => ({
  anonymized: a.anonymized + b.anonymized, skipped: a.skipped + b.skipped, failed: a.failed + b.failed,
});

/** "k sportivi anonimizați." plus "Sărite: n." / "Nereușite: n." when not zero (spec 5). */
export const bulkToast = (r: BulkAnonymizeResult): string =>
  [C.done(r.anonymized), r.skipped ? C.skipped(r.skipped) : '', r.failed ? C.failed(r.failed) : ''].filter(Boolean).join(' ');
```

- [ ] **Step 5: List reload, selection hook, bulk bar**

`src/admin/dashboard/sportivi/useAthleteList.ts`: `AthleteList` gains `reload: () => void;`. `useListLoad` takes a fifth parameter `version: number` and lists it in the effect's dependencies (`[api, phone, key, restart, version]`). In `useAthleteList`:

```ts
  const [version, setVersion] = React.useState(0);
  const reload = React.useCallback(() => setVersion((v) => v + 1), []);
  const loadedList = useListLoad(api, { ...state, q }, phone, restart, version);
  return { state, setState, reload, ...loadedList };
```

`src/admin/dashboard/sportivi/useSelection.ts`:

```ts
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { inactiveShown, listQueryString, showInactive, withPage } from '../../../club/sportivi/list-view';
import { selectionOn, toggled, toggledAll } from '../../../club/sportivi/personal-data-view';
import { SPORTIVI_PATH, wantsInactiveList } from '../../../club/sportivi/routes';
import type { AthleteList } from './useAthleteList';

export type Selection = { ids: ReadonlySet<string>; toggle: (id: string) => void; toggleAll: (rowIds: string[]) => void; done: () => void };

/** Ticked rows of the inactivity list (3C spec 5); null when no checkboxes show. Cleared whenever the list changes (not on "Încarcă încă 30"). */
export function useSelection(list: AthleteList, superAdmin: boolean): Selection | null {
  const [ids, setIds] = React.useState<ReadonlySet<string>>(new Set());
  const key = listQueryString(withPage(list.state, 1), 0);
  React.useEffect(() => setIds(new Set()), [key]);
  const { reload } = list;
  const done = React.useCallback(() => {
    setIds(new Set());
    reload();
  }, [reload]);
  if (!selectionOn(inactiveShown(list.state), superAdmin)) return null;
  return { ids, toggle: (id) => setIds((s) => toggled(s, id)), toggleAll: (rowIds) => setIds((s) => toggledAll(s, rowIds)), done };
}

/** The dashboard's "Vezi lista" (`?inactivi=1`): only "Inactivi de peste N ani", then the plain address. */
export function useInactiveLink(list: AthleteList, search: string): void {
  const navigate = useNavigate();
  const { state, setState } = list;
  React.useEffect(() => {
    if (!wantsInactiveList(search)) return;
    setState(showInactive(state));
    navigate(SPORTIVI_PATH, { replace: true });
  }, [search, state, setState, navigate]);
}
```

`src/admin/dashboard/sportivi/BulkAnonymizeBar.tsx`:

```tsx
import * as React from 'react';
import { Button, adminToast } from '../../ui';
import type { BulkAnonymizeResult } from '../../../club/personal-data/anonymize-plan';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { PERSONAL_DATA_COPY } from '../../../club/personal-data/copy';
import { requestErrorText } from '../../../club/registration-panel';
import { addResults, bulkToast, chunks } from '../../../club/sportivi/personal-data-view';
import { AnonymizeDialog } from './AnonymizeDialog';
import type { SportiviApi } from './api';

type Props = { ids: string[]; api: SportiviApi; done: () => void };

async function anonymizeAll(api: SportiviApi, ids: string[]): Promise<BulkAnonymizeResult> {
  let total: BulkAnonymizeResult = { anonymized: 0, skipped: 0, failed: 0 };
  for (const part of chunks(ids)) total = addResults(total, await api.anonymizeMany(part));
  return total;
}

function useBulkRun({ ids, api, done }: Props) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await anonymizeAll(api, ids);
      (result.failed ? adminToast.warning : adminToast.success)(bulkToast(result));
      setOpen(false);
      done();
    } catch (err) {
      setError(requestErrorText(err, ADMIN_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => (busy ? undefined : setOpen(false));
  return { open, busy, error, start: () => setOpen(true), confirm, cancel };
}

/** "Anonimizează (k)" over the inactivity list (3C spec 5), Super Admin only; one confirmation, one toast with the counts. */
export function BulkAnonymizeBar(props: Props) {
  const run = useBulkRun(props);
  const { ids } = props;
  return (
    <div className="spv-bulk">
      <Button size="sm" variant="danger" onClick={run.start}>{PERSONAL_DATA_COPY.bulkButton(ids.length)}</Button>
      <AnonymizeDialog open={run.open} count={ids.length} busy={run.busy} error={run.error} onCancel={run.cancel} onConfirm={() => void run.confirm()} />
    </div>
  );
}
```

- [ ] **Step 6: List, table, cards**

`src/admin/dashboard/sportivi/SportiviList.tsx` (whole file):

```tsx
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, Button, PageHeader, Window, useIsPhone } from '../../ui';
import { IconPlus } from '../../ui/icons';
import { LIST_COPY, seasonValue } from '../../../club/sportivi/list-view';
import { SPORTIVI_PATH, athleteRecordTo, wantsAddAthlete } from '../../../club/sportivi/routes';
import { AddAthleteDialog } from './AddAthleteDialog';
import { useSportiviApi } from './api';
import { AthleteCards } from './AthleteCards';
import { AthleteTable } from './AthleteTable';
import { BulkAnonymizeBar } from './BulkAnonymizeBar';
import { ActiveFilters, IncompleteBanner, ListToolbar } from './ListToolbar';
import { SPORTIVI_CSS } from './styles';
import { useAthleteList } from './useAthleteList';
import { useInactiveLink, useSelection } from './useSelection';
import { useIsSuperAdmin } from './useSuperAdmin';

/** "Adaugă sportiv" open from the button or from the dashboard shortcut (`?adauga=1`). */
function useAddAthlete(search: string) {
  const navigate = useNavigate();
  const [adding, setAdding] = React.useState(() => wantsAddAthlete(search));
  const closeAdd = () => {
    setAdding(false);
    if (wantsAddAthlete(search)) navigate(SPORTIVI_PATH, { replace: true });
  };
  return { adding, startAdd: () => setAdding(true), closeAdd };
}

/** The private list of every athlete (spec 5), replacing today's public-profile list; 3C: the inactivity list and its bulk bar. */
export function SportiviList() {
  const api = useSportiviApi();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const { search } = useLocation();
  const list = useAthleteList(api, phone);
  const selection = useSelection(list, useIsSuperAdmin());
  useInactiveLink(list, search);
  const { adding, startAdd, closeAdd } = useAddAthlete(search);
  const season = seasonValue(list.state, list.page) || null;
  const open = (documentId: string) => navigate(athleteRecordTo(documentId), { state: { season } });
  const add = <Button icon={<IconPlus />} onClick={startAdd}>{LIST_COPY.add}</Button>;
  return (
    <AdminPage fit>
      <style>{SPORTIVI_CSS}</style>
      <Window>
        <PageHeader title={LIST_COPY.title} subtitle={LIST_COPY.subtitle} actions={add} />
        <ListToolbar list={list} phone={phone} />
        <ActiveFilters list={list} phone={phone} />
        <IncompleteBanner list={list} />
        {selection && selection.ids.size > 0 && <BulkAnonymizeBar ids={[...selection.ids]} api={api} done={selection.done} />}
        {phone ? <AthleteCards list={list} onOpen={open} selection={selection} /> : <AthleteTable list={list} onOpen={open} selection={selection} />}
      </Window>
      {adding && <AddAthleteDialog api={api} season={season} onClose={closeAdd} />}
    </AdminPage>
  );
}
```

`src/admin/dashboard/sportivi/AthleteTable.tsx` (whole file):

```tsx
import * as React from 'react';
import { Link } from 'react-router-dom';
import { Checkbox, EmptyState, Loading, Pager } from '../../ui';
import type { AthleteListPage, AthleteListRow } from '../../../club/athletes/api-types';
import { PERSONAL_DATA_COPY } from '../../../club/personal-data/copy';
import {
  LIST_COPY, acsCell, ageText, groupCell, groupHeader, pageRange, profileCell, withHeaderSort, withPage, type SortKey,
} from '../../../club/sportivi/list-view';
import { allSelected } from '../../../club/sportivi/personal-data-view';
import { athleteRecordTo } from '../../../club/sportivi/routes';
import { MissingMarker } from './MissingMarker';
import type { AthleteList } from './useAthleteList';
import type { Selection } from './useSelection';

type Open = (documentId: string) => void;

const SORT_MARK = { asc: '▲', desc: '▼' } as const;

function SortHeader({ list, sortKey, children }: { list: AthleteList; sortKey: SortKey; children: React.ReactNode }) {
  const { state, setState } = list;
  const dir = state.sort === sortKey ? state.dir : null;
  return (
    <th scope="col" aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button type="button" onClick={() => setState(withHeaderSort(state, sortKey))}>
        {children}
        <span className={dir ? 'ui-table-sort' : 'ui-table-sort spv-unsorted'} aria-hidden="true">{dir ? SORT_MARK[dir] : '↕'}</span>
      </button>
    </th>
  );
}

/** A ticked row never opens the record: the cell swallows the click. */
function CheckCell({ row, selection }: { row: AthleteListRow; selection: Selection }) {
  return (
    <td className="spv-check" onClick={(e) => e.stopPropagation()}>
      <Checkbox checked={selection.ids.has(row.documentId)} onChange={() => selection.toggle(row.documentId)} aria-label={row.name} />
    </td>
  );
}

function Row({ row, onOpen, selection }: { row: AthleteListRow; onOpen: Open; selection: Selection | null }) {
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(row.documentId);
  };
  return (
    <tr className="ui-table-click" onClick={() => onOpen(row.documentId)}>
      {selection && <CheckCell row={row} selection={selection} />}
      <td>
        <Link className="spv-name" to={athleteRecordTo(row.documentId)} onClick={open}>{row.name}</Link>
        {row.dataIncomplete && <MissingMarker row={row} />}
      </td>
      <td>{ageText(row.age)}</td>
      <td className={row.mainGroup ? undefined : 'spv-muted'}>{groupCell(row)}</td>
      <td>
        {row.contactName}
        <span className="spv-sub2">{row.phone}</span>
      </td>
      <td>{acsCell(row)}</td>
      <td>{profileCell(row)}</td>
    </tr>
  );
}

function TableHead({ list, page, selection }: { list: AthleteList; page: AthleteListPage; selection: Selection | null }) {
  const ids = page.data.map((r) => r.documentId);
  return (
    <thead>
      <tr>
        {selection && (
          <th scope="col" className="spv-check">
            <Checkbox checked={allSelected(selection.ids, ids)} onChange={() => selection.toggleAll(ids)} aria-label={PERSONAL_DATA_COPY.selectAll} />
          </th>
        )}
        <SortHeader list={list} sortKey="name">{LIST_COPY.columns.name}</SortHeader>
        <SortHeader list={list} sortKey="age">{LIST_COPY.columns.age}</SortHeader>
        <SortHeader list={list} sortKey="group">{groupHeader(page.season)}</SortHeader>
        <th scope="col">{LIST_COPY.columns.contact}</th>
        <th scope="col">{LIST_COPY.columns.acs}</th>
        <th scope="col">{LIST_COPY.columns.profile}</th>
      </tr>
    </thead>
  );
}

/** Desktop Sportivi table, 50 rows a page (spec 5; documents-bulk-v1); 3C: a checkbox column on the inactivity list. */
export function AthleteTable({ list, onOpen, selection }: { list: AthleteList; onOpen: Open; selection: Selection | null }) {
  const { page, state, setState, failed } = list;
  if (failed) return <EmptyState>{LIST_COPY.loadFailed}</EmptyState>;
  if (!page) return <Loading />;
  if (page.data.length === 0) return <EmptyState>{LIST_COPY.empty}</EmptyState>;
  return (
    <>
      <div className="ui-table-wrap">
        <table className="ui-table">
          <TableHead list={list} page={page} selection={selection} />
          <tbody>{page.data.map((row) => <Row key={row.documentId} row={row} onOpen={onOpen} selection={selection} />)}</tbody>
        </table>
      </div>
      <div className="spv-foot">
        <span>{pageRange(page)}</span>
        {page.pagination.pageCount > 1 && <Pager page={state.page} pageCount={page.pagination.pageCount} onChange={(p) => setState(withPage(state, p))} />}
      </div>
    </>
  );
}
```

The test looks for `selection.toggleAll(ids)`: keep the variable named `ids` in `TableHead`.

`src/admin/dashboard/sportivi/AthleteCards.tsx` (whole file):

```tsx
import * as React from 'react';
import { Button, Checkbox, EmptyState, Loading } from '../../ui';
import type { AthleteListRow } from '../../../club/athletes/api-types';
import { LIST_COPY, ageText, groupCell, loadedRange, withPage } from '../../../club/sportivi/list-view';
import { MissingMarker } from './MissingMarker';
import type { AthleteList } from './useAthleteList';
import type { Selection } from './useSelection';

/** "<vârstă>, <grupă>"; "Fără grupă" muted as in the table. */
function CardLine({ row }: { row: AthleteListRow }) {
  const age = ageText(row.age);
  return (
    <span className="spv-sub2">
      {age && `${age}, `}
      <span className={row.mainGroup ? undefined : 'spv-muted'}>{groupCell(row)}</span>
    </span>
  );
}

function Card({ r, onOpen, selection }: { r: AthleteListRow; onOpen: (documentId: string) => void; selection: Selection | null }) {
  return (
    <li className={selection ? 'spv-card-row' : undefined}>
      {selection && <Checkbox checked={selection.ids.has(r.documentId)} onChange={() => selection.toggle(r.documentId)} aria-label={r.name} />}
      <button type="button" className="spv-card" onClick={() => onOpen(r.documentId)}>
        <span className="spv-name">{r.name}</span>
        {r.dataIncomplete && <MissingMarker row={r} card />}
        <CardLine row={r} />
      </button>
    </li>
  );
}

/** Phone Sportivi: cards, 30 at a time (3b Q30, gaps #37); "Date incomplete" marker (polish 5); 3C: a checkbox on the inactivity list. */
export function AthleteCards({ list, onOpen, selection }: { list: AthleteList; onOpen: (documentId: string) => void; selection: Selection | null }) {
  const { page, rows, state, setState, loading, failed } = list;
  if (failed) return <EmptyState>{LIST_COPY.loadFailed}</EmptyState>;
  if (!page) return <Loading />;
  if (rows.length === 0) return <EmptyState>{LIST_COPY.empty}</EmptyState>;
  const more = page.pagination.page < page.pagination.pageCount;
  return (
    <>
      <p className="spv-count">{loadedRange(page, rows.length)}</p>
      <ul className="spv-cards">
        {rows.map((r) => <Card key={r.documentId} r={r} onOpen={onOpen} selection={selection} />)}
      </ul>
      {more && (
        <div className="spv-more">
          <Button variant="secondary" loading={loading} onClick={() => setState(withPage(state, state.page + 1))}>
            {LIST_COPY.more}
          </Button>
        </div>
      )}
    </>
  );
}
```

`src/admin/dashboard/sportivi/styles.ts`: after the two `.spv-lines` lines of Task 11 add

```
.ui-root .spv-bulk{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--theme-border);background:var(--theme-primary-soft)}
.ui-root .spv-check{width:40px}
.ui-root .spv-card-row{display:flex;align-items:center;gap:10px}
.ui-root .spv-card-row .spv-card{flex:1;min-width:0}
```

- [ ] **Step 7: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/list-3c.test.ts src/club/sportivi/__tests__/list-view.test.ts src/club/sportivi/__tests__/admin-sportivi.test.ts`, `npx vitest run`, `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`
Expected: PASS, PASS, zero errors in both projects, checker exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/club/sportivi/list-view.ts src/club/sportivi/personal-data-view.ts src/admin/dashboard/sportivi src/club/sportivi/__tests__/list-3c.test.ts src/club/sportivi/__tests__/list-view.test.ts src/club/sportivi/__tests__/admin-sportivi.test.ts
git commit -m "feat(sportivi): inactivity filter, anonymized status and bulk anonymize in the list"
```

---

### Task 13: Dashboard notice and "Ani până la anonimizare" in Setări site

**Files:**
- Create: `src/admin/dashboard/PersonalDataNotice.tsx`
- Modify: `src/admin/dashboard/DashboardPage.tsx` (import, one line under the KPI tiles)
- Modify: `src/admin/pages/SetariSitePage.tsx` (interface, defaults, one card)
- Test: `src/club/personal-data/__tests__/admin-dashboard-settings.test.ts`

**Interfaces:**
- Consumes: Task 11 `useSportiviApi().inactiveSummary()`, `.hideInactiveReview()`, `useIsSuperAdmin`, `inactiveListTo`; Task 2 `InactiveSummary`, `DEFAULT_RETENTION_YEARS`, `RETENTION_BOUNDS`, `retentionYearsOf`; Task 1 `PERSONAL_DATA_COPY.notice`, `.noticeLink`, `.noticeHide`, `.settingsCard`, `.settingsField`; existing `Notice`, `Button`, `NumberInput`, `EditorCard`, `Field`, `adminToast` (`src/admin/ui`).
- Produces: `PersonalDataNotice()` (renders nothing unless `summary.shown`); Setări site saves `personalData: { retentionYears, reviewHiddenUntilSeason }` with the page's existing Save bar (content-manager single type, Task 1 attribute).

Behaviour (spec 2, 5): the dashboard shows the notice "N sportivi inactivi de peste N ani." with "Vezi lista" (opens Sportivi with the filter) while the count is not zero and the review is not hidden for the current season; a Super Admin also sees "Ascunde până la sezonul următor". Setări site gains a card "Date personale" with the number field "Ani până la anonimizare" (1 to 20, default 5).

- [ ] **Step 1: Write the failing test**

`src/club/personal-data/__tests__/admin-dashboard-settings.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const admin = (p: string) => readFileSync(join(__dirname, '..', '..', '..', 'admin', p), 'utf8');

describe('dashboard notice (3C spec 5)', () => {
  it('shows while the server says so, links to the list, hides for a Super Admin only', () => {
    const notice = admin('dashboard/PersonalDataNotice.tsx');
    for (const s of [
      'if (!summary?.shown) return null;', 'PERSONAL_DATA_COPY.notice(summary.count, summary.retentionYears)', 'navigate(inactiveListTo)',
      'PERSONAL_DATA_COPY.noticeLink', '{superAdmin && <Button', 'PERSONAL_DATA_COPY.noticeHide', 'await api.hideInactiveReview()', 'api.inactiveSummary()',
    ]) expect(notice, s).toContain(s);
    expect(notice).not.toMatch(/anonymize\(|anonymizeMany\(/);
  });

  it('sits on the dashboard under the KPI tiles', () => {
    const page = admin('dashboard/DashboardPage.tsx');
    expect(page).toContain("import { PersonalDataNotice } from './PersonalDataNotice';");
    expect(page.indexOf('<PersonalDataNotice />')).toBeGreaterThan(page.indexOf('dash-kpis'));
  });
});

describe('Setări site (3C spec 2)', () => {
  it('"Ani până la anonimizare": a number from 1 to 20, default 5, saved in personalData', () => {
    const page = admin('pages/SetariSitePage.tsx');
    for (const s of [
      'PERSONAL_DATA_COPY.settingsCard', 'PERSONAL_DATA_COPY.settingsField', '<NumberInput', 'min={RETENTION_BOUNDS.min}', 'max={RETENTION_BOUNDS.max}',
      'allowEmpty={false}', "form.set('personalData', { ...personalData, retentionYears: retentionYearsOf(next) })",
      'retentionYears: DEFAULT_RETENTION_YEARS',
    ]) expect(page, s).toContain(s);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/personal-data/__tests__/admin-dashboard-settings.test.ts`
Expected: FAIL (`ENOENT ... PersonalDataNotice.tsx`).

- [ ] **Step 3: The notice**

`src/admin/dashboard/PersonalDataNotice.tsx`:

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Notice, adminToast } from '../ui';
import { ADMIN_ERRORS } from '../../club/athletes/errors';
import { PERSONAL_DATA_COPY } from '../../club/personal-data/copy';
import type { InactiveSummary } from '../../club/personal-data/settings';
import { inactiveListTo } from '../../club/sportivi/routes';
import { useSportiviApi, type SportiviApi } from './sportivi/api';
import { useIsSuperAdmin } from './sportivi/useSuperAdmin';

function useInactiveSummary(api: SportiviApi) {
  const [summary, setSummary] = React.useState<InactiveSummary | null>(null);
  React.useEffect(() => {
    let off = false;
    api.inactiveSummary().then((s) => {
      if (!off) setSummary(s);
    }).catch(() => undefined);
    return () => {
      off = true;
    };
  }, [api]);
  return { summary, setSummary };
}

/** Dashboard notice (3C spec 5): while athletes are past the retention period and the review is not hidden this season. It only informs. */
export function PersonalDataNotice() {
  const api = useSportiviApi();
  const superAdmin = useIsSuperAdmin();
  const navigate = useNavigate();
  const { summary, setSummary } = useInactiveSummary(api);
  const [busy, setBusy] = React.useState(false);
  if (!summary?.shown) return null;
  const hide = async () => {
    setBusy(true);
    try {
      setSummary(await api.hideInactiveReview());
    } catch {
      adminToast.error(ADMIN_ERRORS.failed);
    } finally {
      setBusy(false);
    }
  };
  const actions = (
    <>
      <Button size="sm" variant="secondary" onClick={() => navigate(inactiveListTo)}>{PERSONAL_DATA_COPY.noticeLink}</Button>
      {superAdmin && <Button size="sm" variant="ghost" loading={busy} onClick={() => void hide()}>{PERSONAL_DATA_COPY.noticeHide}</Button>}
    </>
  );
  return <Notice tone="info" action={actions}>{PERSONAL_DATA_COPY.notice(summary.count, summary.retentionYears)}</Notice>;
}
```

`src/admin/dashboard/DashboardPage.tsx`: add `import { PersonalDataNotice } from './PersonalDataNotice';` under the other local imports, and right after the KPI block (`{kpis.length > 0 && ( ... )}`, the `dash-kpis` tiles) add:

```tsx
      {/* 3C: athletes past the retention period (spec 5) */}
      <PersonalDataNotice />
```

- [ ] **Step 4: Setări site**

`src/admin/pages/SetariSitePage.tsx`:

Imports: add `NumberInput` to the `../ui` import list, and

```tsx
import { PERSONAL_DATA_COPY } from '../../club/personal-data/copy';
import { DEFAULT_RETENTION_YEARS, RETENTION_BOUNDS, retentionYearsOf, type PersonalDataSettings } from '../../club/personal-data/settings';
```

In the file comment, change "These are the only two attributes on the schema." to "Plus `personalData` (3C): `{ retentionYears, reviewHiddenUntilSeason }`, the number edited here, the season written by the dashboard notice."

Interface and defaults:

```tsx
interface SiteSettings {
  registration: Registration | null;
  contact: Contact | null;
  personalData: PersonalDataSettings | null;
}

const EMPTY_PERSONAL_DATA: PersonalDataSettings = { retentionYears: DEFAULT_RETENTION_YEARS, reviewHiddenUntilSeason: null };
```

In `SetariSitePage`, after `const contact = ...`:

```tsx
  const personalData = normalizeObject<PersonalDataSettings>(form.value.personalData, EMPTY_PERSONAL_DATA);
```

and after the `ObjectFieldCard` of contact data, inside `ui-body`:

```tsx
            <EditorCard title={PERSONAL_DATA_COPY.settingsCard}>
              <Field label={PERSONAL_DATA_COPY.settingsField}>
                <NumberInput
                  value={personalData.retentionYears}
                  min={RETENTION_BOUNDS.min}
                  max={RETENTION_BOUNDS.max}
                  allowEmpty={false}
                  label={PERSONAL_DATA_COPY.settingsField}
                  onChange={(next) => form.set('personalData', { ...personalData, retentionYears: retentionYearsOf(next) })}
                />
              </Field>
            </EditorCard>
```

(the page is a hand-written admin page outside the 30-line rule's new code; the added JSX is 12 lines inside the existing component, no new logic)

- [ ] **Step 5: Run the tests and the checks**

Run: `npx vitest run src/club/personal-data/__tests__/admin-dashboard-settings.test.ts`, `npx vitest run`, `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`
Expected: PASS, PASS, zero errors in both projects, checker exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/admin/dashboard/PersonalDataNotice.tsx src/admin/dashboard/DashboardPage.tsx src/admin/pages/SetariSitePage.tsx src/club/personal-data/__tests__/admin-dashboard-settings.test.ts
git commit -m "feat(personal-data): dashboard notice and retention setting in Setări site"
```

---

### Task 14: Boot check on a throwaway Postgres and renders

**Files:** none in the backend repo. Temporary files in `${TMPDIR:-/tmp}/es3c` (removed at the end). PNGs go to `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase3-renders/` with the prefix `3c-` (not committed by this task; the user reviews them).

**Interfaces:**
- Consumes: everything above.
- Proves (spec 8): export, unzip and read `rezumat.pdf`; after "Anonimizează" a search of the whole database for the seeded name, phone, e-mail and birth date finds nothing; the PDF folder is gone and is not rebuilt; counts per group and season are unchanged; a non-super admin gets 403 on both anonymize routes (and on hiding the review); the bulk anonymize answers its counts; the startup sweep removes a stray folder. Renders at 1440x900 and 390x844: record menu (Super Admin and editor), confirmation, dashboard notice, list with the inactivity filter, checkboxes and bulk bar, bulk confirmation, anonymized record, Setări site field.

Container `es3c-pg` on 127.0.0.1:55438, Strapi on 1347. If a port is taken, pick a free one and change it everywhere below (also `B` in `pass.py`). Never use 1337, 1340, 3010 or 5432. Run every command from the root of the worktree your dispatch names (`REPO=$(git rev-parse --show-toplevel)`). Log in once per admin with curl and once per admin in the browser (Strapi rate-limits `/admin/login`).

- [ ] **Step 1: Full checks**

```bash
cd "$REPO"
npx vitest run
npx tsc --noEmit
npx tsc --noEmit -p src/admin/tsconfig.json
node scripts/admin-ui-check.mjs --strict
```

Expected: all tests PASS, zero type errors in both projects, checker exit 0.

- [ ] **Step 2: Postgres, environment, build**

```bash
T="${TMPDIR:-/tmp}/es3c"; mkdir -p "$T/private"
OUT=/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase3-renders; mkdir -p "$OUT"
cat > "$T/env" <<'EOF'
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55438
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
HOST=127.0.0.1
PORT=1347
APP_KEYS=throwawayA,throwawayB
API_TOKEN_SALT=throwaway
ADMIN_JWT_SECRET=throwaway
TRANSFER_TOKEN_SALT=throwaway
JWT_SECRET=throwaway
ENCRYPTION_KEY=throwaway
STRAPI_TELEMETRY_DISABLED=true
EOF
echo "PRIVATE_FILES_DIR=$T/private" >> "$T/env"
docker run -d --name es3c-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi -p 127.0.0.1:55438:5432 postgres:16
until docker exec es3c-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
```

Expected: `✔ Building admin panel`.

- [ ] **Step 3: Synthetic data, two admins, Strapi**

```bash
cat > "$T/fixture.js" <<'EOF'
const fs = require('node:fs');
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const now = new Date();
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const season = (a, isCurrent) => d('api::season.season').create({ data: { label: `${a}-${a + 1}`, startMonth: `${a}-09-01`, endMonth: `${a + 1}-06-30`, membershipFee: 270, isCurrent } });
  const old = await season(y - 6, false);
  const cur = await season(y, true);
  const school = await d('api::section.section').create({ data: { name: 'Școala de patinaj', kind: 'school', slug: 'scoala', publicPage: true, order: 1 } });
  const group = async (name, order) => (await d('api::group.group').create({ data: { name, section: school.documentId, order, active: true } })).documentId;
  const g = { inc: await group('Începători', 1), pp: await group('Primii Pași', 2) };
  const athlete = async (a) => (await d('api::athlete.athlete').create({ data: { status: 'activ', dataIncomplete: false, ...a } })).documentId;
  const member = (athleteId, groupId, s) => d('api::group-membership.group-membership').create({ data: { athlete: athleteId, group: groupId, season: s.documentId, isMain: true, from: `${s.label.slice(0, 4)}-09-15` } });
  const ids = { number: `${y}-0142`, old: [] };
  const upload = async (n) => {
    const filepath = `${process.env.IDS_FILE}.${n}.png`;
    fs.writeFileSync(filepath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
    return (await app.plugin('upload').service('upload').upload({ data: {}, files: { filepath, originalFilename: `${n}.png`, mimetype: 'image/png', size: fs.statSync(filepath).size } }))[0];
  };
  const own = await upload('own-photo'); const shared = await upload('shared-photo');
  Object.assign(ids, { ownFile: String(own.id), ownUrl: own.url, sharedFile: String(shared.id), sharedUrl: shared.url });
  await d('api::team-member.team-member').create({ data: { name: 'Antrenor Test', photo: shared.id } });
  ids.profile = (await d('api::sportsperson.sportsperson').create({ data: { name: 'Ilinca Zamfirescu', slug: 'ilinca-zamfirescu', showPublicPage: true, photo: own.id, gallery: [shared.id] }, status: 'published' })).documentId;
  ids.ilinca = await athlete({ name: 'Ilinca Zamfirescu', birthDate: '2013-04-27', contactName: 'Dana Zamfirescu', phone: '0799 000 111', email: 'dana.zamfirescu@example.com', notes: 'Alergie la polen', publicProfile: ids.profile });
  await member(ids.ilinca, g.inc, cur);
  await d('api::acs-membership.acs-membership').create({ data: { athlete: ids.ilinca, season: cur.documentId, state: 'da' } });
  ids.irina = await athlete({ name: 'Irina Pereche', birthDate: '2014-05-02', contactName: 'Paul Pereche', phone: '0722 333 444', email: 'paul@example.com' });
  await member(ids.irina, g.pp, cur);
  ids.pair = (await d('api::athlete-duplicate.athlete-duplicate').create({ data: { first: ids.ilinca, second: ids.irina } })).documentId;
  for (const name of ['Vechi Unu', 'Vechi Doi', 'Vechi Trei']) {
    const id = await athlete({ name, birthDate: '2008-01-01', contactName: 'Părinte Vechi', phone: '0733 000 000', email: 'vechi@example.com' });
    await member(id, g.pp, old);
    ids.old.push(id);
  }
  ids.reg = (await d('api::registration-submission.registration-submission').create({ data: {
    email: 'dana.zamfirescu@example.com', phone: '0799 000 111', childName: 'Ilinca Zamfirescu', childBirthDate: '27.04.2013', parentName: 'Dana Zamfirescu',
    shirtSize: 'S', status: 'Confirmat', season: cur.label, seasonRef: cur.documentId, section: school.documentId, registrationNumber: ids.number,
    submittedAt: `${y}-09-20T10:00:00.000Z`, relationship: 'parinte', childHeight: 142, lastSeason: 'Începători', membershipAnswer: 'da',
    priorExperience: 'Pași înainte', expectations: 'Să sară', source: 'Facebook', gdprConsent: true, regulationsConsent: true,
    internalNote: 'Sună după 18', submissionKey: 'key-ilinca-3c', archived: false, athlete: ids.ilinca,
  } })).documentId;
  await d('api::email-job.email-job').create({ data: { recipient: 'dana.zamfirescu@example.com', subject: `Înscriere ${ids.number} Ilinca Zamfirescu`, kind: 'registration', registration: ids.reg, status: 'queued', attempts: 0 } });
  const editorRole = await app.db.query('admin::role').findOne({ where: { code: 'strapi-editor' } });
  await app.service('admin::user').create({ email: 'editor@example.com', firstname: 'Editor', lastname: 'Test', password: 'Throwaway123', isActive: true, roles: [editorRole.id] });
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids));
  console.log('fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
EOF
(set -a; . "$T/env"; set +a; IDS_FILE="$T/ids.json" node -e "$(cat "$T/fixture.js")")
(set -a; . "$T/env"; set +a; npx strapi admin:create-user --email=admin@example.com --password='Throwaway123' --firstname=Admin)
start() { (set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid"); until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1347/_health | grep -q 204; do sleep 2; done; }
start
```

Expected: `fixture ok`, the Super Admin created, `/_health` answers 204. If `app.service('admin::user')` is undefined in this Strapi version, use `app.admin.services.user.create(...)` with the same data.

- [ ] **Step 4: History, PDFs and an e-mail resend through the real routes**

```bash
login() { curl -s -X POST http://127.0.0.1:1347/admin/login -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"Throwaway123\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])'; }
SUPER=$(login admin@example.com); EDITOR=$(login editor@example.com)
idof() { python3 -c "import json,sys; v=json.load(open('$T/ids.json'))[sys.argv[1]]; print(v if isinstance(v, str) else ' '.join(v))" "$1"; }
ILINCA=$(idof ilinca); REG=$(idof reg); PAIR=$(idof pair); NUMBER=$(idof number)
call() { curl -s -o /dev/null -w '%{http_code}\n' -X "$2" "http://127.0.0.1:1347/api$3" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' ${4:+-d "$4"}; }
call "$SUPER" PUT "/club/athletes/$ILINCA" '{"name":"Ilinca Zamfirescu","birthDate":"27.04.2013","contactName":"Dana Zamfirescu","phone":"0799 123 456","email":"dana.zamfirescu@example.com"}'
call "$SUPER" POST "/club/athlete-duplicates/$PAIR/dismiss" '{}'
call "$SUPER" GET "/club/registrations/$REG/documents/acord"
call "$SUPER" GET "/club/registrations/$REG/documents/adeziune"
call "$SUPER" POST "/club/registrations/$REG/resend-email" '{}'
ls "$T/private/registrations/$REG"
```

Expected: five lines `200` (the resend keeps its job queued: no e-mail provider here); two PDFs listed (Acord and Cerere de adeziune).

- [ ] **Step 5: Export (any admin), unzip, read the summary**

```bash
curl -s -D "$T/export.h" -o "$T/export.zip" "http://127.0.0.1:1347/api/club/athletes/$ILINCA/export" -H "Authorization: Bearer $EDITOR"
grep -i '^content-type\|^content-disposition' "$T/export.h"
unzip -l "$T/export.zip"
rm -rf "$T/x" && mkdir "$T/x" && unzip -q "$T/export.zip" -d "$T/x"
node -e "import('unpdf').then(async ({ extractText, getDocumentProxy }) => { const pdf = await getDocumentProxy(new Uint8Array(require('fs').readFileSync(process.argv[1]))); const { totalPages, text } = await extractText(pdf, { mergePages: true }); console.log(totalPages + ' ' + text.replace(/\s+/g, ' ')); })" "$T/x/rezumat.pdf" > "$T/rezumat.txt"
for s in 'Date personale: Ilinca Zamfirescu' 'Grupe pe sezoane' 'Membru A.C.S. pe sezoane' "Înscrierea $NUMBER" 'Istoric' '0799 123 456' 'Începători, principală' 'Generat la'; do grep -q "$s" "$T/rezumat.txt" && echo "ok: $s" || echo "MISSING: $s"; done
curl -s "http://127.0.0.1:1347/api/club/athletes/$ILINCA/history" -H "Authorization: Bearer $SUPER" | grep -o 'Date exportate'
```

Expected: `Content-Type: application/zip`, `Content-Disposition: attachment; filename="date-ilinca-zamfirescu-<today>.zip"`; `unzip -l` lists `rezumat.pdf` and two PDFs under `inscrieri/<NUMBER>/`; eight `ok:` lines, no `MISSING`; `Date exportate` printed once.

- [ ] **Step 6: Counts and the database search before**

```bash
q() { docker exec -i es3c-pg psql -U strapi -d strapi -At -c "$1"; }
COUNTS="select (select count(*) from group_memberships), (select count(*) from acs_memberships), (select count(*) from registration_submissions), (select count(*) from athletes)"
PER_GROUP="select g.group_id, s.season_id, count(*) from group_memberships_group_lnk g join group_memberships_season_lnk s on s.group_membership_id = g.group_membership_id group by 1, 2 order by 1, 2"
q "$COUNTS" > "$T/counts-before"; q "$PER_GROUP" > "$T/per-group-before"; cat "$T/counts-before" "$T/per-group-before"
SEEDED='Zamfirescu|Ilinca|0799 123 456|0799123456|0799 000 111|0799000111|dana\.zamfirescu@example\.com|2013-04-27|27\.04\.2013|Alergie la polen|key-ilinca-3c|Sună după 18'
search() { docker exec es3c-pg pg_dump -U strapi --data-only --inserts strapi | grep -Eio "$SEEDED" | sort | uniq -c; }
search
```

Expected: `5|1|1|5` (memberships, A.C.S., registrations, athletes) and three per-group lines (two groups in the current season, one in the old one); `search` prints several hits (it works). If the link-table columns differ, list them with `q '\d group_memberships_group_lnk'`, adjust `PER_GROUP`, and keep the same query for the "after" diff.

- [ ] **Step 7: A non-super admin is refused (spec 8)**

```bash
call "$EDITOR" POST "/club/athletes/$ILINCA/anonymize" '{}'
call "$EDITOR" POST "/club/athletes/anonymize" "{\"documentIds\":[\"$ILINCA\"]}"
call "$EDITOR" POST "/club/athletes/inactive-summary/hide" '{}'
call "$EDITOR" GET "/club/athletes/inactive-summary"
```

Expected: `403`, `403`, `403`, `200`.

- [ ] **Step 8: Renders before the anonymization (Super Admin, then the editor)**

Needs Python Playwright with Chromium (`pip install playwright && playwright install chromium`).

```bash
cat > "$T/pass.py" <<'EOF'
import asyncio, json, sys
from playwright.async_api import async_playwright

B = 'http://127.0.0.1:1347/admin'
IDS = json.load(open(sys.argv[1]))
OUT, PHASE, STATE = sys.argv[2], sys.argv[3], sys.argv[4]
LIST = B + '/plugins/edusport-sportivi'
DESKTOP = {'width': 1440, 'height': 900}
PHONE = {'width': 390, 'height': 844}
SIZES = (('desktop', DESKTOP), ('phone', PHONE))

def shot(name):
    return f'{OUT}/3c-{name}.png'

async def login(b, email, state_out):
    ctx = await b.new_context(viewport=DESKTOP)
    pg = await ctx.new_page()
    await pg.goto(B + '/auth/login'); await pg.wait_for_timeout(1500)
    await pg.fill('input[name=email]', email); await pg.fill('input[name=password]', 'Throwaway123')
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)
    await ctx.storage_state(path=state_out); await ctx.close()

async def open_page(b, size, state, r):
    ctx = await b.new_context(viewport=size, storage_state=state)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: r['page_errors'].append(str(e)))
    return ctx, pg

async def record_menu(pg, r, tag):
    await pg.goto(f"{LIST}/{IDS['ilinca']}"); await pg.wait_for_timeout(3000)
    await pg.get_by_role('button', name='Mai multe acțiuni').click(); await pg.wait_for_timeout(400)
    r[f'menu_{tag}'] = await pg.locator('.spv-menu [role=menuitem]').all_inner_texts()
    await pg.screenshot(path=shot(f'record-menu-{tag}'))

async def confirm(pg, r, tag):
    await pg.locator('.spv-menu [role=menuitem]', has_text='Anonimizează').click(); await pg.wait_for_timeout(500)
    r[f'confirm_{tag}'] = await pg.get_by_role('alertdialog').inner_text()
    await pg.screenshot(path=shot(f'anonymize-confirm-{tag}'))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)

async def notice(pg, r, tag):
    await pg.goto(B); await pg.wait_for_timeout(3500)
    box = pg.locator('.ui-notice', has_text='inactivi')
    r[f'notice_{tag}'] = await box.inner_text()
    await box.scroll_into_view_if_needed()
    await pg.screenshot(path=shot(f'dashboard-notice-{tag}'))
    return box

async def bulk(pg, box, r, tag):
    await box.get_by_role('button', name='Vezi lista').click(); await pg.wait_for_timeout(3000)
    r[f'list_url_{tag}'] = pg.url
    if tag == 'phone':
        for check in await pg.locator('.spv-cards').get_by_role('checkbox').all(): await check.check()
    else:
        await pg.get_by_label('Selectează tot').check()
    await pg.wait_for_timeout(400)
    r[f'bulk_{tag}'] = await pg.locator('.spv-bulk').inner_text()
    await pg.screenshot(path=shot(f'list-inactive-bulk-{tag}'), full_page=True)
    await pg.locator('.spv-bulk').get_by_role('button').click(); await pg.wait_for_timeout(500)
    r[f'bulk_confirm_{tag}'] = await pg.get_by_role('alertdialog').inner_text()
    await pg.screenshot(path=shot(f'bulk-confirm-{tag}'))
    await pg.keyboard.press('Escape')

async def settings(pg, r, tag):
    await pg.goto(B + '/plugins/edusport-setari'); await pg.wait_for_timeout(3000)
    field = pg.get_by_label('Ani până la anonimizare', exact=True).first
    await field.scroll_into_view_if_needed()
    r[f'settings_{tag}'] = await field.input_value()
    await pg.screenshot(path=shot(f'setari-site-{tag}'))

async def filter_panel(pg, r):
    await pg.goto(LIST); await pg.wait_for_timeout(2500)
    await pg.locator('.ui-fbtn').click(); await pg.wait_for_timeout(400)
    sheet = pg.locator('.ui-sheetdd')
    await sheet.locator('.ui-fnav-item', has_text='Date personale').click(); await pg.wait_for_timeout(300)
    r['filter_option'] = await sheet.get_by_label('Inactivi de peste 5 ani').count()
    await pg.screenshot(path=shot('list-filter-desktop'))
    await pg.keyboard.press('Escape')

async def before(b, r):
    await login(b, 'admin@example.com', STATE)
    for tag, size in SIZES:
        ctx, pg = await open_page(b, size, STATE, r)
        await record_menu(pg, r, tag); await confirm(pg, r, tag)
        await bulk(pg, await notice(pg, r, tag), r, tag)
        await settings(pg, r, tag)
        if tag == 'desktop': await filter_panel(pg, r)
        await ctx.close()

async def editor(b, r):
    await login(b, 'editor@example.com', STATE + '.editor')
    ctx, pg = await open_page(b, DESKTOP, STATE + '.editor', r)
    await record_menu(pg, r, 'editor')
    await pg.keyboard.press('Escape')
    r['notice_editor_buttons'] = await (await notice(pg, r, 'editor')).get_by_role('button').all_inner_texts()
    await ctx.close()

async def after(b, r):
    for tag, size in SIZES:
        ctx, pg = await open_page(b, size, STATE, r)
        await pg.goto(f"{LIST}/{IDS['ilinca']}"); await pg.wait_for_timeout(3000)
        r[f'anon_menu_{tag}'] = await pg.get_by_role('button', name='Mai multe acțiuni').count()
        r[f'anon_edit_{tag}'] = await pg.get_by_role('button', name='Editează').count()
        r[f'anon_tabs_{tag}'] = await pg.get_by_role('tab').all_inner_texts()
        await pg.screenshot(path=shot(f'record-anonymized-{tag}'), full_page=True)
        await ctx.close()
    ctx, pg = await open_page(b, DESKTOP, STATE, r)
    await pg.goto(LIST); await pg.wait_for_timeout(2500)
    r['default_list_shows_anonymized'] = await pg.get_by_text('Sportiv anonimizat').count()
    await pg.goto(B); await pg.wait_for_timeout(3500)
    r['notice_after'] = await pg.locator('.ui-notice', has_text='inactivi').count()
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        r = {'page_errors': []}
        await {'before': before, 'editor': editor, 'after': after}[PHASE](b, r)
        for k, v in r.items():
            print(f'{k}: {v}')
        await b.close()

asyncio.run(main())
EOF
python3 "$T/pass.py" "$T/ids.json" "$OUT" before "$T/state.json"
python3 "$T/pass.py" "$T/ids.json" "$OUT" editor "$T/state.json"
```

Expected (before):

```
page_errors: []
menu_desktop: ['Marchează inactiv', 'Unește cu alt sportiv', 'Exportă datele', 'Anonimizează', 'Șterge sportivul']
confirm_desktop: (contains) Anonimizezi datele sportivului?, the "Se șterg: ..." line, the "Rămân: ..." line, Acțiunea nu poate fi anulată., Anonimizează
notice_desktop: (contains) 3 sportivi inactivi de peste 5 ani., Vezi lista, Ascunde până la sezonul următor
list_url_desktop: http://127.0.0.1:1347/admin/plugins/edusport-sportivi
bulk_desktop: Anonimizează (3)
bulk_confirm_desktop: (contains) Anonimizezi datele pentru 3 sportivi?
settings_desktop: 5
filter_option: 1
(the same menu_, confirm_, notice_, bulk_ lines for phone)
```

Expected (editor):

```
page_errors: []
menu_editor: ['Marchează inactiv', 'Unește cu alt sportiv', 'Exportă datele', 'Șterge sportivul']
notice_editor_buttons: ['Vezi lista']
```

- [ ] **Step 9: Anonymize one athlete, then prove it (spec 8)**

```bash
call "$SUPER" POST "/club/athletes/$ILINCA/anonymize" '{}'
call "$SUPER" POST "/club/athletes/$ILINCA/anonymize" '{}'
search
test -d "$T/private/registrations/$REG" && echo 'PDF folder still there' || echo 'PDF folder gone'
call "$SUPER" GET "/club/registrations/$REG/documents/acord"
test -d "$T/private/registrations/$REG" && echo 'PDF rebuilt' || echo 'PDF not rebuilt'
q "$COUNTS" | diff - "$T/counts-before" && echo 'counts unchanged'
q "$PER_GROUP" | diff - "$T/per-group-before" && echo 'per group and season unchanged'
q "select status, recipient is null, subject is null from email_jobs"
q "select count(*) from sportspeople"
q "select id from files where id in ($(idof ownFile), $(idof sharedFile)) order by id"
for f in ownUrl sharedUrl; do test -f "public$(idof $f)" && echo "$f on disk" || echo "$f gone"; done
q "select name, status, anonymized_at is not null from athletes where document_id = '$ILINCA'"
q "select child_name, email is null, phone is null, registration_number, status from registration_submissions where document_id = '$REG'"
```

Expected: `200`, `409`; `search` prints nothing (if a hit is in `strapi_history_versions`, stop: Needs decision N2); `PDF folder gone`; `404`; `PDF not rebuilt`; `counts unchanged`; `per group and season unchanged`; `cancelled|t|t`; `0`; only the shared photo's id (the profile's own photo row is deleted, the photo the team member also uses stays); `ownUrl gone`, `sharedUrl on disk`; `Sportiv anonimizat|anonimizat|t`; `Anonimizat|t|t|<NUMBER>|Confirmat`.

- [ ] **Step 10: Bulk anonymize and the review**

```bash
BODY=$(python3 -c "import json; d=json.load(open('$T/ids.json')); print(json.dumps({'documentIds': d['old'] + [d['ilinca']]}))")
curl -s "http://127.0.0.1:1347/api/club/athletes?inactive=true" -H "Authorization: Bearer $SUPER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["pagination"]["total"])'
curl -s -X POST "http://127.0.0.1:1347/api/club/athletes/anonymize" -H "Authorization: Bearer $SUPER" -H 'Content-Type: application/json' -d "$BODY"; echo
curl -s "http://127.0.0.1:1347/api/club/athletes/inactive-summary" -H "Authorization: Bearer $SUPER"; echo
curl -s "http://127.0.0.1:1347/api/club/athletes?status=anonimizat" -H "Authorization: Bearer $SUPER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["pagination"]["total"])'
q "$COUNTS" | diff - "$T/counts-before" && echo 'counts unchanged'
```

Expected: `3`; `{"data":{"anonymized":3,"skipped":1,"failed":0}}`; `{"data":{"retentionYears":5,"count":0,"seasonLabel":"<current>","shown":false}}`; `4`; `counts unchanged`.

- [ ] **Step 11: Renders after**

```bash
python3 "$T/pass.py" "$T/ids.json" "$OUT" after "$T/state.json"
```

Expected:

```
page_errors: []
anon_menu_desktop: 0
anon_edit_desktop: 0
anon_tabs_desktop: ['Date', 'Istoric...'] (two tabs, the second with its count)
anon_menu_phone: 0
anon_edit_phone: 0
default_list_shows_anonymized: 0
notice_after: 0
```

- [ ] **Step 12: Startup sweep**

```bash
mkdir -p "$T/private/registrations/$REG" && touch "$T/private/registrations/$REG/stray.pdf"
kill "$(cat "$T/pid")"; while kill -0 "$(cat "$T/pid")" 2>/dev/null; do sleep 1; done
start; sleep 5
test -d "$T/private/registrations/$REG" && echo 'sweep missed it' || echo 'swept'
grep -c 'startup sweep failed' "$T/strapi.log"
```

Expected: `swept`, `0`.

- [ ] **Step 13: Look at the renders**

Open `phase3-renders/3c-*.png`: record menu (Super Admin, editor), confirmation, dashboard notice, inactivity list with checkboxes and bulk bar, bulk confirmation, filter panel, anonymized record, Setări site field, each at desktop and phone. Check: no em dash, no middle dot, straight quotes, no pill or circle (square checkboxes), no dashed or dotted line, the confirmation's three lines each on their own line, the phone layouts without horizontal scroll. Show them to the user in the companion (renders are reviewed after implementation, DECISIONS phase3ab). Fixes go into the owning task's files with a `fix(personal-data): ...` or `fix(sportivi): ...` commit and the affected steps are repeated.

- [ ] **Step 14: Clean up**

```bash
kill "$(cat "$T/pid")"
docker rm -f es3c-pg
rm -rf "$T"
```

Expected: container removed. No commit in this task unless a check failed (then the fix commit above). The PNGs stay in the frontend repo for the user to review.

---

## Notes for the executors

- `src/club/personal-data/copy.ts` is the only place for 3C wording; a new string goes there and in "Decided while planning" item 9, never inline in a component.
- `isAnonymized` (Task 3) is the one test for "anonymized" on the server; `isReadOnlyRecord` (Task 11) the one in the admin bundle.
- Phase 5 (payments): extend `inactivity.ts::lastActiveYears` with payment and attendance seasons, and add payment personal fields to `anonymize-plan.ts` key lists; payment totals stay (spec 5 and 4).
- The public privacy page (`/protectia-datelor`) is not touched (spec 9).

## Self-review

- **Spec coverage.**
  - 2 Data: athlete `anonimizat` + `anonymizedAt`, site-settings `personalData` (Task 1), reader and default (Task 2), Setări site field (Task 13), history actions (Task 1), no schema change on registrations and history entries; e-mail jobs gain only `cancelled` (Task 1, decided item 2).
  - 3 Export: menu item (Task 11), route `GET .../export` with `global::is-admin`, `application/zip`, file name, 404 unknown/anonymized (Tasks 9, 10), `rezumat.pdf` sections with the existing PDF tools (Task 4), stored PDFs under `inscrieri/<nr>/` (Task 9), `fflate` direct dependency (Task 9), "Document indisponibil" (Tasks 4, 9), history `data-exported`, failure only logged (Task 9), detached client, toast and shared error (Task 11). Boot check Step 5.
  - 4 Anonymize: menu item for Super Admin only, not when anonymized (Task 11), confirmation copy (Tasks 1, 11), route with `global::is-super-admin`, 404/409 (Tasks 6, 10), one transaction with registration locks then `lockAthlete` (Task 6, lock rule), athlete scrub, registration scrub and kept fields, PDF folders after commit with sweep (Tasks 3, 5, 6, 10), e-mail jobs (Tasks 3, 5, 6), history and confirmation scrubbing (Tasks 3, 6), public profile through the existing delete path without `previousSlugs` (Task 6), duplicate rows removed (Task 6), counts kept (Tasks 6, 14), `data-anonymized` (Task 6), matches refreshed through `safely` and matching skips anonymized (Tasks 6, 7), hidden from the list unless "Anonimizat", read-only record, never in search, still counted (Tasks 7, 8, 11, 12, 14).
  - 5 Yearly list: rule (Task 2), filter "Date personale" / "Inactivi de peste N ani", status "Anonimizat", checkboxes and bulk bar for a Super Admin (Tasks 8, 12), bulk route max 200 with `{ anonymized, skipped, failed }` and the toast (Tasks 3, 6, 10, 12), confirmation with k (Task 12), dashboard notice, "Vezi lista", "Ascunde până la sezonul următor" (Tasks 8, 10, 13).
  - 6 Access: policy (Task 10), client role from `/admin/users/me` (Task 11).
  - 7 Errors and copy: `guarded` wrappers in every service, one copy module (Tasks 1, 6, 8, 9).
  - 8 Tests and proof: planner, scrubbing, rule boundaries, settings reader (Tasks 2, 3), store parity (Task 5), route policy source test (Task 10), UI source tests (Tasks 11 to 13), boot check (Task 14).
- **Placeholder scan:** every code step carries its code or the exact replacement; no TBD; no "similar to Task N".
- **Type consistency:** `RegistrationScrub`, `AthleteScrub`, `BulkAnonymizeResult`, `MAX_BULK` (Task 3) are used with these names in Tasks 5, 6, 10, 11, 12; `PersonalDataSettings`, `InactiveSummary` (Task 2) in Tasks 5, 8, 11, 13; `AnonymizeContext`, `RemoveFiles` (Task 6) and `ExportContext`, `ExportDocument` (Task 9) in Task 10; `RecordMenuKey`, `recordMenuItems`, `isReadOnlyRecord` (Task 11) in Tasks 11, 12; `Selection` (Task 12) in its own files; `AthleteList.reload` added in Task 12 before `useSelection` uses it.
- **Review Focus:** concurrency and repeats (Task 6), PDF after anonymization (Tasks 7, 14), folder removal failure and sweep (Tasks 6, 14), odd season data (Task 2), export edge cases (Tasks 4, 9): each has its test.
