# Phase 2D: Registration PDFs (Acord, Cerere de adeziune) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every registration gets its Acord (and, with membership Da, its Cerere de adeziune) as a one-page A4 PDF drawn in code with pdfkit, stored privately, downloadable for 24 hours from the success screen and at any time from the admin; editing a registration rebuilds them without an e-mail; blank forms print the current season, period and fee.

**Architecture:** Everything lives in `src/club/documents/`. Pure parts first: values (registration + Sezon -> what is printed), text content (the approved wording as styled runs), and a small line-layout engine (wrap, justify, tinted values, blank lines) that mirrors the mockups' CSS. The pdfkit drawing (`pdf/`) places header, body and the 4-column footer at the mockups' sizes (1 mockup px = 595.28/560 pt) and shrinks only the body when a page would overflow. Storage writes new files before deleting old ones under `PRIVATE_FILES_DIR`; an HMAC token signs the 24-hour public link. Thin Strapi wiring: one service file, one controller, one route file, and two small edits in the registration controller (submit, admin edit).

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS, `strict: false`), pdfkit 0.20.2 (+ `@types/pdfkit` 0.17.6), Inter 4.1 and Climate Crisis (OFL) bundled in `assets/fonts`, `unpdf` 1.9.1 (dev, PDF text extraction in tests), Vitest 3, Node 22.

**User decisions applied (2026-10-21, D1-D7):** body shrunk to about 88% with the full 4-column footer (D1); legal numbers from the mockups, the club confirms them before going live (D2); ș/ț with the comma below everywhere, the Cerere and the O.G. sentence included (D3); Climate Crisis bundled (D4); an expired or bad link redirects (302) to the site page `/inscrieri/link-expirat` (D5); 2B writes "Document refăcut" from the PUT `rebuild` field (D6); deleting a registration deletes its PDFs, singly or with the archived season (D7, extended by the controller to the bulk path). Cross-plan review I1: moving a registration to another season (move, move whole season, or a PUT of `season`) keeps `seasonRef` in step and rebuilds the PDFs; M11: `touchesDocuments` and `rebuildDocuments` are exported from `index.ts`.

**Spec:** `docs/superpowers/specs/2026-10-19-registration-rebuild-design.md` section 4.1 (plus 3.4 and 5). Decisions: `../edusport_frontend/docs/portal/DECISIONS.md` entries 2026-10-03 (document-v4, Nr. înscriere), 2026-10-05 (adeziune, blank templates, legal footer option B, header, typo fixes, rebuild on edit, no e-mail on edit), 2026-10-19 (pdfkit, private folder, backup). A dated decision wins over the spec. Cross-plan contract: the shared brief (`phase2-plan-brief.md`, section "Cross-plan contract").

**Builds on plan 2A** (`docs/superpowers/plans/2026-10-19-phase2a-registration-data.md`), merged first. Used from 2A: `RELATIONSHIP_OPTIONS`, `MEMBERSHIP_YES` (`src/club/registration-form-options.ts`), `asText` (`src/club/narrow.ts`), `findCurrentSeason` (`src/club/current-season.ts`), `submitRegistration`, `SubmitResult`, `SubmitDeps`, `SUBMIT_ERRORS` (`src/club/registration-submit.ts`), the service method `createNumbered` (already returns `{ documentId, registrationNumber }`), and the `seasonRef`, `relationship`, `relationshipOther`, `membershipAnswer` attributes.

**Validated:** the code in this plan was applied on 2026-10-21 (after the user's decisions) to a scratch clone of `feat/registration-rebuild` with plan 2A applied first: Vitest 273 passed (1 skipped: the preview writer), `tsc --noEmit` zero errors; the Task 9 boot check ran on a throwaway Postgres (Strapi `NODE_ENV=production`, port 1344): submit returned `{"ok":true,"registrationNumber":"2026-0001","downloadToken":"...","documents":["acord","adeziune"]}`, both files were written as `Maria_Stefanescu_Acord_2026-2027.pdf` / `..._Adeziune_...`, the token download returned 200 `application/pdf`, a bad token a 302 to `https://scoaladepatinaj.com/inscrieri/link-expirat`, the admin routes 403 without and 200 with an admin JWT, an edit of `childName` rebuilt both files under the new name and removed the old ones, deleting the registration removed its folder, deleting an archived season of two registrations removed both folders, `move-season` to an existing Sezon linked `seasonRef` and renamed the PDFs to `..._2027-2028.pdf` with the number unchanged, `move-whole-season` to an unknown label cleared `seasonRef`, kept the PDFs and logged the reason, and a PUT back to `2026-2027` relinked and rebuilt them, the Cerere printed `octombrie 2026-mai 2027 este de 270 ron` read from Postgres, and without `DOCUMENT_TOKEN_SECRET` the submit returned 503 with nothing saved. The container was removed. The rendered pages were compared with headless-Chrome screenshots of the approved mockups (Task 10 reproduces this).

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, branch `feat/registration-rebuild`; Strapi 5, TypeScript in `src/`, single quotes in `src/`.
- Functions < 30 lines; cyclomatic complexity < 10; no `any` (`UID.ContentType` for UIDs, `Core.Strapi` for the instance).
- Tests: `npm test` (Vitest) and `npx tsc --noEmit` with zero errors after every task. (`tsconfig.json` excludes `*.test.*`, so test files are only checked by Vitest.)
- New content types (none in 2D) keep `pluginOptions.content-manager.visible: false` and `createCoreRouter(..., { only: [] })`. Admin routes use `global::is-admin`; public routes `{ auth: false, policies: [], middlewares: [] }`.
- Copy rules for user-visible text: no em dash, no middle dot, no emoji; terse; UI copy in Romanian, code and docs in English; never pad the client's own wording. The document text is the club's legal wording, word for word from the approved mockups, with only the 2026-10-05 typo fixes (its en dashes "–" are the club's and stay) and ș/ț written with the comma below everywhere (user, 2026-10-21): never the cedilla letters U+015E, U+015F, U+0162, U+0163.
- No rounded pills or circles, no dashed or dotted lines (the PDFs use solid rules and square tick boxes only).
- Commits: Conventional Commits, no AI attribution, no `Co-Authored-By`. Never push. Never run anything against production, the user's local database (container `strapi_db`) or the running `strapi_app` container.
- Boot checks use a throwaway Postgres container on a free port and Strapi on 1338 or higher (1337 is taken); remove the container afterwards. 2D has no schema change, so no type generation.
- PDFs are drawn with pdfkit (DECISIONS 2026-10-19), never a headless browser. One A4 page per document.
- Files are stored only under `PRIVATE_FILES_DIR` (default `<app>/private/documents`), never under `public/`. File names `Nume_Prenume_Tip-document_Sezon.pdf`, no diacritics.
- Editing a registration never sends an e-mail (DECISIONS 2026-10-05).

## Review Focus

- Long answers (a long parent name, e-mail, "Alta" free text, double-barrelled child name) must not push the Acord onto a second page or under the footer: the body shrinks step by step and the page stays one A4 sheet (Task 7: "stays one page with very long answers", both documents).
- Registrations from before phase 2 (no `seasonRef`, no `relationship`, maybe no number) opened from the admin must still produce a correct one-page Acord with blank lines, not an error (Task 2: missing answers stay blank, season label fallback; Task 7: "an old registration ..."; Task 8: the admin route builds a missing set).
- A download link must open only its own registration, only for 24 hours, and never with a forged or re-signed token; an expired or forged link lands on the site's "link expirat" page, never on raw JSON (Task 6 token tests: other id with the same signature, rotated secret, expiry edge; Task 8: 302 redirect test).
- A failed rebuild must never leave a registration without its PDF, and a status or archive change must not rewrite the PDFs (Task 6: old files kept when a write fails, no leftover `.tmp`; Task 8: `touchesDocuments` ignores status, note, archive).
- Production without `DOCUMENT_TOKEN_SECRET` must refuse registrations with nothing saved instead of issuing links anyone could forge (Task 6: fails closed; Task 8: `submitBlockedReason`; Task 9: 503 and zero rows).
- A registration moved to another season must print the new season everywhere (header, clause g period, file name) and keep its number; a move to a label with no Sezon must not print a wrong period, so the old PDFs stay and the reason is logged (Task 8: `season-move.test.ts`, `season-move-pdf.test.ts`; Task 9 run).
- A deleted registration must not leave its PDFs (personal data) in the private folder, and deleting twice or with the files already gone must not fail The same holds for deleting a season's archived registrations, where a folder that fails must not stop the others (Task 6: `removeStored`; Task 8: `deleteRegistrationDocuments` and `deleteRegistrationsWithDocuments` tests; Task 9: folder gone after DELETE).

---

## File Structure

```
assets/fonts/                     Inter-{Regular,Bold,BoldItalic,ExtraBold}.ttf, ClimateCrisis-Variable.ttf, Inter-OFL.txt, ClimateCrisis-OFL.txt (Task 1)
src/club/documents/
  types.ts                        DocumentKind, StoredDocument, DocumentSeason, DocumentValues (Task 2)
  format.ts                       months, dd.mm.yyyy, fee, relationship label, file names (Task 2)
  values.ts                       registration row / Sezon -> DocumentValues; blank values; which kinds (Task 2)
  runs.ts                         styled text runs and blank lines (Task 3)
  pdf/layout.ts                   pure line layout: words, wrap, justify, runs per line (Task 3)
  association.ts                  footer details from the approved mockups (Task 5)
  acord-content.ts                Acord wording as runs (Task 5)
  adeziune-content.ts             Cerere de adeziune wording as runs (Task 5)
  storage.ts                      private folder, safe ids, list, replace (new first, then delete), remove (Task 6)
  token.ts                        24-hour HMAC download token, fails closed in production (Task 6)
  pdf/style.ts                    page geometry, colors, fonts (Task 7)
  pdf/draw.ts                     paragraphs, labels, lines, tick boxes (Task 7)
  pdf/blocks.ts                   title, tick rows, scaled body, frames, overflow error (Task 7)
  pdf/frame.ts                    header (CLUBUL SPORTIV / EDUSPORT, Sezonul, Nr. înscriere) and 4-column footer (Task 7)
  pdf/acord.ts, pdf/adeziune.ts   the two pages (Task 7)
  pdf/render.ts                   renderDocument: one page, body shrinks only if needed (Task 7)
  requests.ts                     route input checks, expired-link redirect URL, download headers, which edits rebuild (Task 8)
  service.ts                      buildRegistrationDocuments, listRegistrationDocuments, deleteRegistrationDocuments, renderBlankDocument (Task 8)
  submit-response.ts              finishSubmit, submitBlockedReason (Task 8)
  bulk-delete.ts                  deleteRegistrationsWithDocuments: ids, rows, then folders (Task 8)
  season-move.ts                  moveRegistrationsToSeason: season text + seasonRef, then rebuild (Task 8)
  index.ts                        public exports for other plans (Task 8)
src/api/club/controllers/documents.ts   publicDownload, registrationDocument, blankForm (Task 8)
src/api/club/routes/03-documents.ts     the three routes of the contract (Task 8)
src/club/registration-submit.ts         SubmitResult and createNumbered carry the internal documentId (Task 8)
src/api/registration-submission/controllers/registration-submission.ts  submit builds PDFs; admin edit and season moves rebuild; admin delete and delete-archived-season remove them (Task 8)
config/admin.ts, .gitignore, .dockerignore, Dockerfile.production, docker-compose.production.yml, scripts/backup.sh, .env.example (Task 4)
```

## Tasks and parallel groups

| Group | Tasks | Runs after |
|---|---|---|
| A | 1 Dependencies and fonts, 2 Values and formats, 3 Line layout, 4 Deploy and repo files (touches deploy config) | plan 2A; all four in parallel (separate files; only Task 1 edits `package.json`) |
| B | 5 Document wording, 6 Storage and download token | group A; both in parallel |
| C | 7 PDF drawing | group B |
| D | 8 Service, routes, submit and edit wiring | group C |
| E | 9 Boot check on a throwaway Postgres, 10 Visual check for the companion | group D; both in parallel |

---

### Task 1: Dependencies and bundled fonts

**Files:**
- Modify: `package.json`, `package-lock.json` (npm install)
- Create: `assets/fonts/Inter-Regular.ttf`, `assets/fonts/Inter-Bold.ttf`, `assets/fonts/Inter-BoldItalic.ttf`, `assets/fonts/Inter-ExtraBold.ttf`, `assets/fonts/Inter-OFL.txt`
- Create: `assets/fonts/ClimateCrisis-Variable.ttf`, `assets/fonts/ClimateCrisis-OFL.txt`
- Test: `src/club/documents/__tests__/assets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the npm packages `pdfkit` (dependency), `@types/pdfkit` and `unpdf` (devDependencies); font files at `<repo>/assets/fonts/` with the exact names above (Task 7 loads them from `process.cwd()/assets/fonts`; Strapi runs from the repo root locally and from `/opt/app` in the image, where the Dockerfile copies everything except `node_modules`, `backups` and `.git`).

Why these fonts: the mockups set the body, values and footer in Inter (400, 700, 700 italic for the two bold-italic sentences, 800 for the clause letters) and the EDUSPORT wordmark in Climate Crisis (the site's wordmark font, `edusport_frontend/public/fonts/ClimateCrisis-1979.woff2`). Both are SIL Open Font License 1.1; the licence text ships next to the files, as the OFL requires. The Climate Crisis file is Google Fonts' variable font; its default instance is YEAR 1979, the one the site uses, and pdfkit draws that default instance. (The site's `.woff2` copy draws nothing in pdfkit: its glyphs come out empty.)

- [ ] **Step 1: Write the failing test**

`src/club/documents/__tests__/assets.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { expect, it } from 'vitest';

const FONTS = path.resolve(__dirname, '..', '..', '..', '..', 'assets', 'fonts');
const FILES = ['Inter-Regular.ttf', 'Inter-Bold.ttf', 'Inter-BoldItalic.ttf', 'Inter-ExtraBold.ttf', 'ClimateCrisis-Variable.ttf'];

it('bundles the fonts with their OFL licences', () => {
  for (const file of FILES) expect(existsSync(path.join(FONTS, file))).toBe(true);
  expect(readFileSync(path.join(FONTS, 'Inter-OFL.txt'), 'utf8')).toContain('SIL Open Font License, Version 1.1');
  expect(readFileSync(path.join(FONTS, 'ClimateCrisis-OFL.txt'), 'utf8')).toContain('SIL Open Font License, Version 1.1');
});

it('pdfkit loads every bundled font', () => {
  const doc = new PDFDocument();
  for (const file of FILES) expect(() => doc.font(path.join(FONTS, file))).not.toThrow();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/club/documents/__tests__/assets.test.ts`
Expected: FAIL (`Cannot find package 'pdfkit'`).

- [ ] **Step 3: Install the packages**

```bash
npm install pdfkit@0.20.2
npm install -D @types/pdfkit@0.17.6 unpdf@1.9.1
```

Expected `package.json` additions: `"pdfkit": "^0.20.2"` under `dependencies`; `"@types/pdfkit": "^0.17.6"` and `"unpdf": "^1.9.1"` under `devDependencies`. (`@types/pdfkit` 0.17 still matches every API this plan uses: `registerFont`, `font`, `fontSize`, `text` with `lineBreak`, `wordSpacing`, `characterSpacing`, `widthOfString`, `rect`, `moveTo`, `lineTo`, `save`, `restore`, `translate`, `scale`.)

- [ ] **Step 4: Add the fonts and their licences**

Inter 4.1 (release zip SHA-256 `9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e`), Climate Crisis pinned to google/fonts commit `9eabeac108ec4c1ba76e792cf35ad11f72c7bc53` (font) and `66247cd5cf8b633a8a91a162d025d12a8aaffaf0` (licence):

```bash
TMP="$(mktemp -d)"
curl -sSL -o "$TMP/inter.zip" https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
shasum -a 256 "$TMP/inter.zip"   # 9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e
mkdir -p assets/fonts
unzip -j -o "$TMP/inter.zip" extras/ttf/Inter-Regular.ttf extras/ttf/Inter-Bold.ttf extras/ttf/Inter-BoldItalic.ttf extras/ttf/Inter-ExtraBold.ttf -d assets/fonts
unzip -p "$TMP/inter.zip" LICENSE.txt > assets/fonts/Inter-OFL.txt
curl -sSL -o assets/fonts/ClimateCrisis-Variable.ttf \
  "https://raw.githubusercontent.com/google/fonts/9eabeac108ec4c1ba76e792cf35ad11f72c7bc53/ofl/climatecrisis/ClimateCrisis%5BYEAR%5D.ttf"
curl -sSL -o assets/fonts/ClimateCrisis-OFL.txt \
  "https://raw.githubusercontent.com/google/fonts/66247cd5cf8b633a8a91a162d025d12a8aaffaf0/ofl/climatecrisis/OFL.txt"
shasum -a 256 assets/fonts/*
rm -rf "$TMP"
```

Expected SHA-256:

```
288316099b1e0a47a4716d159098005eef7c0066921f34e3200393dbdb01947f  assets/fonts/Inter-Bold.ttf
948405a16cdc62701da5f4005ed068ca5f4d27061d98f7974ccfc37831d9581d  assets/fonts/Inter-BoldItalic.ttf
e6756ad5690b77606aa62249a7b420d9902d45cae4b0048a24911fd4324b0a22  assets/fonts/Inter-ExtraBold.ttf
40d692fce188e4471e2b3cba937be967878f631ad3ebbbdcd587687c7ebe0c82  assets/fonts/Inter-Regular.ttf
262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a  assets/fonts/Inter-OFL.txt
4b25279f80e420f9f09dbba13eb14d0beabfa013d17f74bad19cc9fdf4d55523  assets/fonts/ClimateCrisis-Variable.ttf
ff2b5b1644c4fcdf1d5bea41205b694e0d865f3170301e4143a8b6f43ac72ebe  assets/fonts/ClimateCrisis-OFL.txt
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npm test -- src/club/documents/__tests__/assets.test.ts`
Expected: PASS (2 tests). Then `npm test` (all PASS) and `npx tsc --noEmit` (zero errors).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json assets/fonts src/club/documents/__tests__/assets.test.ts
git commit -m "build(documents): add pdfkit and bundle the Inter and Climate Crisis fonts (OFL)"
```

---

### Task 2: Values and formats

**Files:**
- Create: `src/club/documents/types.ts`, `src/club/documents/format.ts`, `src/club/documents/values.ts`
- Test: `src/club/documents/__tests__/format.test.ts`, `src/club/documents/__tests__/values.test.ts`

**Interfaces:**
- Consumes (plan 2A): `RELATIONSHIP_OPTIONS`, `MEMBERSHIP_YES` from `src/club/registration-form-options.ts`; `asText(v: unknown): string` from `src/club/narrow.ts`.
- Produces:
  - `types.ts`: `type DocumentKind = 'acord' | 'adeziune'`, `DOCUMENT_KINDS`, `interface StoredDocument { kind: DocumentKind; fileName: string; path: string }`, `isDocumentKind(v: unknown): v is DocumentKind`, `type DocumentSeason = { label: string; startMonth: string; endMonth: string; membershipFee: number | null }`, `type DocumentValues` (12 nullable strings: `registrationNumber, parentName, phone, email, relationship, childName, birthDate, date, season, periodStart, periodEnd, fee`).
  - `format.ts`: `monthYear(iso)`, `formatBirthDate(raw)`, `formatDay(iso)`, `formatFee(fee)`, `relationshipLabel(value, other)`, `asciiWords(text)`, `documentFileName(kind, childName, season, fallback)`, `blankFileName(kind, season)`, `kindFromFileName(fileName): DocumentKind | null`.
  - `values.ts`: `type RegistrationRow` (documentId plus unknown fields), `seasonValues(season)`, `blankValues(season): DocumentValues`, `registrationValues(row, season): DocumentValues`, `documentKindsFor(row): DocumentKind[]`.

Rules: birth date printed dd.mm.yyyy (DECISIONS 2026-10-03: the script form sends `yyyy-mm-dd`); "Data" on the Acord is the submit day in Romania; the Cerere prints the fee as `270 ron`; the period comes from the Sezon months; file names `Nume_Prenume_Tip-document_Sezon.pdf` without diacritics (the child's name as typed; mockup example `Maria_Dumitrescu_Adeziune_2026-2027.pdf`); the Cerere only with membership Da. A missing value is `null`, which the PDF prints as a blank line, so old registrations still render.

- [ ] **Step 1: Write the failing tests**

`src/club/documents/__tests__/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  asciiWords,
  blankFileName,
  documentFileName,
  formatBirthDate,
  formatDay,
  formatFee,
  kindFromFileName,
  monthYear,
  relationshipLabel,
} from '../format';

describe('document formats', () => {
  it('prints Sezon months in Romanian', () => {
    expect(monthYear('2026-10-01')).toBe('octombrie 2026');
    expect(monthYear('2027-05-31')).toBe('mai 2027');
    expect(monthYear('')).toBeNull();
    expect(monthYear('2026-13-01')).toBeNull();
  });

  it('prints the birth date as dd.mm.yyyy whatever the form sent', () => {
    expect(formatBirthDate('2014-03-14')).toBe('14.03.2014');
    expect(formatBirthDate('4.3.2014')).toBe('04.03.2014');
    expect(formatBirthDate('14/03/2014')).toBe('14.03.2014');
    expect(formatBirthDate(' martie 2014 ')).toBe('martie 2014');
    expect(formatBirthDate('')).toBeNull();
  });

  it('prints the submit day in Romanian time', () => {
    expect(formatDay('2026-10-02T22:30:00.000Z')).toBe('03.10.2026');
    expect(formatDay('nu e o dată')).toBeNull();
    expect(formatDay(null)).toBeNull();
  });

  it('prints the fee as the Cerere does', () => {
    expect(formatFee(270)).toBe('270 ron');
    expect(formatFee(270.5)).toBe('270,5 ron');
    expect(formatFee(null)).toBeNull();
  });

  it('prints the relationship label, or the free text for Alta', () => {
    expect(relationshipLabel('parinte', null)).toBe('Părinte');
    expect(relationshipLabel('tutore', 'ignored')).toBe('Tutore Legal');
    expect(relationshipLabel('alta', ' Bunic ')).toBe('Bunic');
    expect(relationshipLabel('alta', '')).toBeNull();
    expect(relationshipLabel(null, null)).toBeNull();
  });

  it('names files Nume_Prenume_Tip-document_Sezon.pdf without diacritics', () => {
    expect(asciiWords('  Maria-Ștefania  Țăranu ')).toBe('Maria_Stefania_Taranu');
    expect(asciiWords('Ioana Şerban')).toBe('Ioana_Serban');
    expect(documentFileName('acord', 'Maria Dumitrescu', '2026-2027', '2026-0142')).toBe('Maria_Dumitrescu_Acord_2026-2027.pdf');
    expect(documentFileName('adeziune', 'Îonuț Bâlă', '2026-2027', '')).toBe('Ionut_Bala_Adeziune_2026-2027.pdf');
    expect(documentFileName('acord', '', null, '2026-0142')).toBe('2026_0142_Acord_fara-sezon.pdf');
    expect(blankFileName('adeziune', '2026-2027')).toBe('Formular-gol_Adeziune_2026-2027.pdf');
  });

  it('reads the kind back from a stored file name', () => {
    expect(kindFromFileName('Maria_Dumitrescu_Acord_2026-2027.pdf')).toBe('acord');
    expect(kindFromFileName('Maria_Dumitrescu_Adeziune_2026-2027.pdf')).toBe('adeziune');
    expect(kindFromFileName('Maria_Dumitrescu_Acord_2026-2027.pdf.abc.tmp')).toBeNull();
    expect(kindFromFileName('notes.txt')).toBeNull();
  });
});
```

`src/club/documents/__tests__/values.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { DocumentSeason } from '../types';
import { blankValues, documentKindsFor, registrationValues } from '../values';

const SEASON: DocumentSeason = { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270 };
const ROW = {
  documentId: 'reg0000000000000000000001',
  registrationNumber: '2026-0142',
  parentName: ' Mihaela Dumitrescu ',
  phone: '0723456789',
  email: 'parinte@exemplu.ro',
  relationship: 'parinte',
  childName: 'Maria Dumitrescu',
  childBirthDate: '2014-03-14',
  membershipAnswer: 'da',
  submittedAt: '2026-10-03T08:00:00.000Z',
  season: '2026-2027',
};

describe('document values', () => {
  it('prints only the form answers, the number, the submit day and the Sezon', () => {
    expect(registrationValues(ROW, SEASON)).toEqual({
      registrationNumber: '2026-0142',
      parentName: 'Mihaela Dumitrescu',
      phone: '0723456789',
      email: 'parinte@exemplu.ro',
      relationship: 'Părinte',
      childName: 'Maria Dumitrescu',
      birthDate: '14.03.2014',
      date: '03.10.2026',
      season: '2026-2027',
      periodStart: 'octombrie 2026',
      periodEnd: 'mai 2027',
      fee: '270 ron',
    });
  });

  it('leaves missing answers blank and falls back to the season label of old registrations', () => {
    const values = registrationValues({ documentId: 'reg0000000000000000000002', season: '2025-2026' }, null);
    expect(values).toMatchObject({ registrationNumber: null, relationship: null, childName: null, season: '2025-2026', periodStart: null, fee: null });
  });

  it('a blank form prints only season, period and fee', () => {
    expect(blankValues(SEASON)).toEqual({
      registrationNumber: null,
      parentName: null,
      phone: null,
      email: null,
      relationship: null,
      childName: null,
      birthDate: null,
      date: null,
      season: '2026-2027',
      periodStart: 'octombrie 2026',
      periodEnd: 'mai 2027',
      fee: '270 ron',
    });
    expect(blankValues(null).season).toBeNull();
  });

  it('adds the Cerere de adeziune only for membership Da', () => {
    expect(documentKindsFor(ROW)).toEqual(['acord', 'adeziune']);
    expect(documentKindsFor({ ...ROW, membershipAnswer: 'nu' })).toEqual(['acord']);
    expect(documentKindsFor({ ...ROW, membershipAnswer: null })).toEqual(['acord']);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- src/club/documents/__tests__/format.test.ts src/club/documents/__tests__/values.test.ts`
Expected: FAIL (modules `../format`, `../values` not found).

- [ ] **Step 3: Implement**

`src/club/documents/types.ts`:

```ts
/** The two generated documents: the Acord (every registration) and the Cerere de adeziune (membership Da). */
export type DocumentKind = 'acord' | 'adeziune';

export const DOCUMENT_KINDS: readonly DocumentKind[] = ['acord', 'adeziune'];

/** A generated PDF on disk, in the private documents folder. */
export interface StoredDocument {
  kind: DocumentKind;
  fileName: string;
  path: string;
}

export function isDocumentKind(value: unknown): value is DocumentKind {
  return value === 'acord' || value === 'adeziune';
}

/** The Sezon values printed on the documents. */
export type DocumentSeason = { label: string; startMonth: string; endMonth: string; membershipFee: number | null };

/** Everything the PDFs print. `null` prints a blank line, filled in by hand on paper. */
export type DocumentValues = {
  registrationNumber: string | null;
  parentName: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  childName: string | null;
  birthDate: string | null;
  date: string | null;
  season: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  fee: string | null;
};
```

`src/club/documents/format.ts`:

```ts
import { RELATIONSHIP_OPTIONS } from '../registration-form-options';
import type { DocumentKind } from './types';

const MONTHS = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

const pad2 = (n: string) => n.padStart(2, '0');

/** "2026-10-01" -> "octombrie 2026" (the Sezon stores months as dates). */
export function monthYear(isoDate: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(isoDate ?? '');
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return month ? `${month} ${m[1]}` : null;
}

/** Birth date as dd.mm.yyyy (DECISIONS 2026-10-03), from "yyyy-mm-dd" or "d.m.yyyy"; anything else as typed. */
export function formatBirthDate(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return `${pad2(iso[3])}.${pad2(iso[2])}.${iso[1]}`;
  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (dmy) return `${pad2(dmy[1])}.${pad2(dmy[2])}.${dmy[3]}`;
  return text || null;
}

/** The day of an ISO timestamp in Romania, as dd.mm.yyyy ("Data" on the Acord). */
export function formatDay(iso: string | null | undefined): string | null {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')}.${part('month')}.${part('year')}`;
}

/** 270 -> "270 ron", 270.5 -> "270,5 ron" (as the Cerere prints it). */
export function formatFee(fee: number | null | undefined): string | null {
  if (typeof fee !== 'number' || !Number.isFinite(fee)) return null;
  return `${String(fee).replace('.', ',')} ron`;
}

/** "in calitate de ..." on the Acord: the option label, or the free text for Alta. */
export function relationshipLabel(value: string | null | undefined, other: string | null | undefined): string | null {
  if (value === 'alta') return (other ?? '').trim() || null;
  return RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label ?? null;
}

/** Letters and digits only, words joined by "_", no diacritics: "Maria Ștefănescu" -> "Maria_Stefanescu". */
export function asciiWords(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const TYPE_IN_NAME: Record<DocumentKind, string> = { acord: 'Acord', adeziune: 'Adeziune' };
const seasonPart = (season: string | null) => (season && /^\d{4}-\d{4}$/.test(season) ? season : 'fara-sezon');

/** `Nume_Prenume_Tip-document_Sezon.pdf`, no diacritics (DECISIONS, CMS admin proposal). */
export function documentFileName(kind: DocumentKind, childName: string | null, season: string | null, fallback: string): string {
  const name = asciiWords(childName) || asciiWords(fallback) || 'Inscriere';
  return `${name}_${TYPE_IN_NAME[kind]}_${seasonPart(season)}.pdf`;
}

/** Blank forms: `Formular-gol_Acord_2026-2027.pdf`. */
export function blankFileName(kind: DocumentKind, season: string | null): string {
  return `Formular-gol_${TYPE_IN_NAME[kind]}_${seasonPart(season)}.pdf`;
}

/** The kind encoded in a stored file name, or null for any other file. */
export function kindFromFileName(fileName: string): DocumentKind | null {
  const m = /_(Acord|Adeziune)_[^_]+\.pdf$/.exec(fileName);
  if (!m) return null;
  return m[1] === 'Acord' ? 'acord' : 'adeziune';
}
```

`src/club/documents/values.ts`:

```ts
import { asText } from '../narrow';
import { MEMBERSHIP_YES } from '../registration-form-options';
import { formatBirthDate, formatDay, formatFee, monthYear, relationshipLabel } from './format';
import type { DocumentKind, DocumentSeason, DocumentValues } from './types';

/** The registration fields the documents print, as read from the database (anything may be missing on old rows). */
export type RegistrationRow = {
  documentId: string;
  registrationNumber?: unknown;
  parentName?: unknown;
  phone?: unknown;
  email?: unknown;
  relationship?: unknown;
  relationshipOther?: unknown;
  childName?: unknown;
  childBirthDate?: unknown;
  membershipAnswer?: unknown;
  submittedAt?: unknown;
  season?: unknown;
};

const orNull = (v: unknown) => asText(v) || null;

/** Season, period and fee: the only values a blank form prints. */
export function seasonValues(season: DocumentSeason | null): Pick<DocumentValues, 'season' | 'periodStart' | 'periodEnd' | 'fee'> {
  return {
    season: season?.label ?? null,
    periodStart: monthYear(season?.startMonth),
    periodEnd: monthYear(season?.endMonth),
    fee: formatFee(season?.membershipFee),
  };
}

/** A blank form: season, period and fee printed, everything else a line for paper (DECISIONS 2026-10-05). */
export function blankValues(season: DocumentSeason | null): DocumentValues {
  const none = { registrationNumber: null, parentName: null, phone: null, email: null, relationship: null };
  return { ...none, childName: null, birthDate: null, date: null, ...seasonValues(season) };
}

/** What a registration's documents print. Only form answers are used; address and CNP are never stored. */
export function registrationValues(row: RegistrationRow, season: DocumentSeason | null): DocumentValues {
  const values = {
    ...seasonValues(season),
    registrationNumber: orNull(row.registrationNumber),
    parentName: orNull(row.parentName),
    phone: orNull(row.phone),
    email: orNull(row.email),
    relationship: relationshipLabel(asText(row.relationship), asText(row.relationshipOther)),
    childName: orNull(row.childName),
    birthDate: formatBirthDate(asText(row.childBirthDate)),
    date: formatDay(asText(row.submittedAt)),
  };
  return { ...values, season: values.season ?? orNull(row.season) };
}

/** The Acord for every registration; the Cerere de adeziune only when the membership answer is Da. */
export function documentKindsFor(row: RegistrationRow): DocumentKind[] {
  return row.membershipAnswer === MEMBERSHIP_YES ? ['acord', 'adeziune'] : ['acord'];
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -- src/club/documents/__tests__/format.test.ts src/club/documents/__tests__/values.test.ts`
Expected: PASS (11 tests). Then `npx tsc --noEmit`: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/documents/types.ts src/club/documents/format.ts src/club/documents/values.ts \
  src/club/documents/__tests__/format.test.ts src/club/documents/__tests__/values.test.ts
git commit -m "feat(documents): printed values, formats and file names for registration PDFs"
```

---

### Task 3: Line layout

**Files:**
- Create: `src/club/documents/runs.ts`, `src/club/documents/pdf/layout.ts`
- Test: `src/club/documents/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `runs.ts`: `type TextStyle = 'regular' | 'bold' | 'boldItalic' | 'value' | 'link'`, `type Run = { text: string; style: TextStyle } | { blank: number }` (blank width in mockup px), helpers `t`, `b`, `bi`, `link`, `v(value | null, blankPx)`, `blank(px)`, `runsText(runs)`.
  - `pdf/layout.ts`: `type Measure = (text, style) => number`, `type LayoutOptions = { width; measure; align: 'justify' | 'left'; valuePad; scale }`, `type PlacedRun = { kind: 'text'; x; width; text; style; wordSpacing } | { kind: 'blank'; x; width }`, `toWords`, `wrapWords`, `lineRuns`, `placeLine`, `layoutParagraph(runs, o): PlacedRun[][]`.

Why our own layout: the mockups justify the body, tint filled values (`.v`: bold, navy, `#eef1f8`, padding 0 3px), print blank lines (`.bl`: underline of a fixed width, margin 0 2px) inside sentences, and keep "Dumitrescu," together. pdfkit's `continued` text cannot tint or place blanks. The layout is pure (a `measure` function is injected), so it is tested without a PDF. Two rules found while validating: a run never starts with a space (pdf.js drops such a space when the text is copied, so "regulament Regulamentele" became "regulamentRegulamentele"), and a tint or underline stops at the trimmed text.

- [ ] **Step 1: Write the failing test**

`src/club/documents/__tests__/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { layoutParagraph, lineRuns, toWords } from '../pdf/layout';
import { blank, t, v } from '../runs';

/** 1 pt per character, so widths are easy to reason about. */
const o = { width: 20, measure: (text: string) => text.length, align: 'justify' as const, valuePad: 0, scale: 1 };

describe('paragraph layout', () => {
  it('keeps a value and the punctuation after it in one word', () => {
    const words = toWords([t('de '), v('Ana Pop', 60), t(', telefon')]);
    expect(words.map((w) => w.map((f) => ('blank' in f ? '_' : f.text)).join(''))).toEqual(['de', 'Ana', 'Pop,', 'telefon']);
  });

  it('ends each run with the space after it and never starts one with a space', () => {
    const runs = lineRuns(toWords([t('copilul '), v('Ana Pop', 60), t(' la '), blank(20), t(' Bl')]));
    expect(runs).toEqual([
      { kind: 'text', text: 'copilul ', style: 'regular' },
      { kind: 'text', text: 'Ana Pop ', style: 'value' },
      { kind: 'text', text: 'la ', style: 'regular' },
      { kind: 'blank', px: 20 },
      { kind: 'text', text: ' Bl', style: 'regular' },
    ]);
  });

  it('wraps and stretches every line but the last to the full width', () => {
    const lines = layoutParagraph([t('aaaa bbbb cccc dddd eeee ffff')], o);
    expect(lines).toHaveLength(2);
    const first = lines[0][lines[0].length - 1];
    expect(first.x + first.width).toBeCloseTo(20);
    expect(lines[1][0]).toMatchObject({ kind: 'text', text: 'eeee ffff', wordSpacing: 0 });
  });

  it('draws a blank as a line of the mockup width plus its margins', () => {
    const [line] = layoutParagraph([t('CNP '), blank(10)], { ...o, align: 'left', width: 100 });
    expect(line[1]).toEqual({ kind: 'blank', x: 4, width: 14 });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/club/documents/__tests__/layout.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/club/documents/runs.ts`:

```ts
/** Inline text styles of the mockups: plain, <b>, <b><i>, filled value (<b class="v">), link (<span class="u">). */
export type TextStyle = 'regular' | 'bold' | 'boldItalic' | 'value' | 'link';

/** A piece of a paragraph: styled text, or a blank line of `blank` mockup px for writing by hand. */
export type Run = { text: string; style: TextStyle } | { blank: number };

export const t = (text: string): Run => ({ text, style: 'regular' });
export const b = (text: string): Run => ({ text, style: 'bold' });
export const bi = (text: string): Run => ({ text, style: 'boldItalic' });
export const link = (text: string): Run => ({ text, style: 'link' });

/** A filled value, or a blank line of the mockup's width when there is no value. */
export const v = (value: string | null, blankPx: number): Run =>
  value ? { text: value, style: 'value' } : { blank: blankPx };

export const blank = (px: number): Run => ({ blank: px });

/** The plain text of a paragraph (blank lines left out), for tests and checks. */
export function runsText(runs: Run[]): string {
  return runs.map((r) => ('blank' in r ? '' : r.text)).join('');
}
```

`src/club/documents/pdf/layout.ts`:

```ts
import type { Run, TextStyle } from '../runs';

/** Width in pt of `text` in `style` at the paragraph's size. */
export type Measure = (text: string, style: TextStyle) => number;

export type LayoutOptions = {
  width: number;
  measure: Measure;
  align: 'justify' | 'left';
  /** Horizontal padding of a filled value's tint, pt (mockup: padding 0 3px). */
  valuePad: number;
  /** pt per mockup px, for blank lines. */
  scale: number;
};

/** A run placed on a line: x from the paragraph's left edge, width in pt. */
export type PlacedRun =
  | { kind: 'text'; x: number; width: number; text: string; style: TextStyle; wordSpacing: number }
  | { kind: 'blank'; x: number; width: number };

type Frag = { text: string; style: TextStyle } | { blank: number };
type Word = Frag[];
type RawRun = { kind: 'text'; text: string; style: TextStyle } | { kind: 'blank'; px: number };

const BLANK_MARGIN_PX = 2; // mockup .bl: margin 0 2px

/** Split runs into words; pieces not separated by whitespace stay one word ("Dumitrescu,"). */
export function toWords(runs: Run[]): Word[] {
  const words: Word[] = [];
  let current: Word = [];
  const flush = () => {
    if (current.length) words.push(current);
    current = [];
  };
  for (const run of runs) {
    if ('blank' in run) current.push(run);
    else
      for (const part of run.text.split(/(\s+)/)) {
        if (/^\s+$/.test(part)) flush();
        else if (part) current.push({ text: part, style: run.style });
      }
  }
  flush();
  return words;
}

function fragWidth(frag: Frag, o: LayoutOptions): number {
  if ('blank' in frag) return (frag.blank + 2 * BLANK_MARGIN_PX) * o.scale;
  return o.measure(frag.text, frag.style) + (frag.style === 'value' ? 2 * o.valuePad : 0);
}

/** Greedy line breaking: as many words per line as fit `o.width`. */
export function wrapWords(words: Word[], o: LayoutOptions): Word[][] {
  const space = o.measure(' ', 'regular');
  const lines: Word[][] = [];
  let line: Word[] = [];
  let used = 0;
  for (const word of words) {
    const w = word.reduce((sum, f) => sum + fragWidth(f, o), 0);
    if (line.length && used + space + w > o.width) {
      lines.push(line);
      line = [];
      used = 0;
    }
    used += (line.length ? space : 0) + w;
    line.push(word);
  }
  if (line.length) lines.push(line);
  return lines;
}

/**
 * The space between two words ends the run before it; a run never starts with a space, since pdf.js
 * drops such a space when the text is copied. A tint or underline stops at the trimmed text (draw.ts).
 */
function addGap(runs: RawRun[]): void {
  const last = runs[runs.length - 1];
  if (last?.kind === 'text') last.text += ' ';
  else runs.push({ kind: 'text', text: ' ', style: 'regular' });
}

/** Appends a text fragment to the last run when it has the same style; false when it cannot. */
function appendSame(runs: RawRun[], frag: Frag, sep: string): boolean {
  const last = runs[runs.length - 1];
  if ('blank' in frag || last?.kind !== 'text' || last.style !== frag.style) return false;
  last.text += sep + frag.text;
  return true;
}

/** Joins a fragment to the line's runs; `gap` is true before the first fragment of every word but the first. */
function pushFrag(runs: RawRun[], frag: Frag, gap: boolean): void {
  if (appendSame(runs, frag, gap ? ' ' : '')) return;
  if (gap) addGap(runs);
  if (appendSame(runs, frag, '')) return;
  runs.push('blank' in frag ? { kind: 'blank', px: frag.blank } : { kind: 'text', text: frag.text, style: frag.style });
}

/** One line's words as runs of one style each (spaces kept, so copied text reads naturally). */
export function lineRuns(line: Word[]): RawRun[] {
  const runs: RawRun[] = [];
  line.forEach((word, wi) => word.forEach((frag, fi) => pushFrag(runs, frag, wi > 0 && fi === 0)));
  return runs;
}

const spacesIn = (text: string) => text.split(' ').length - 1;

function runWidth(run: RawRun, wordSpacing: number, o: LayoutOptions): number {
  if (run.kind === 'blank') return (run.px + 2 * BLANK_MARGIN_PX) * o.scale;
  const pad = run.style === 'value' ? 2 * o.valuePad : 0;
  return o.measure(run.text, run.style) + spacesIn(run.text) * wordSpacing + pad;
}

/** Positions the runs of a line; justified lines (all but the last) stretch their spaces to the full width. */
export function placeLine(runs: RawRun[], o: LayoutOptions, last: boolean): PlacedRun[] {
  const natural = runs.reduce((sum, r) => sum + runWidth(r, 0, o), 0);
  const spaces = runs.reduce((sum, r) => sum + (r.kind === 'text' ? spacesIn(r.text) : 0), 0);
  const stretch = o.align === 'justify' && !last && spaces > 0;
  const wordSpacing = stretch ? Math.max(0, (o.width - natural) / spaces) : 0;
  let x = 0;
  return runs.map((run) => {
    const width = runWidth(run, wordSpacing, o);
    const placed: PlacedRun =
      run.kind === 'blank' ? { kind: 'blank', x, width } : { kind: 'text', x, width, text: run.text, style: run.style, wordSpacing };
    x += width;
    return placed;
  });
}

/** Lays a paragraph out into lines of placed runs. */
export function layoutParagraph(runs: Run[], o: LayoutOptions): PlacedRun[][] {
  const lines = wrapWords(toWords(runs), o);
  return lines.map((line, i) => placeLine(lineRuns(line), o, i === lines.length - 1));
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/club/documents/__tests__/layout.test.ts`
Expected: PASS (4 tests). Then `npx tsc --noEmit`: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/documents/runs.ts src/club/documents/pdf/layout.ts src/club/documents/__tests__/layout.test.ts
git commit -m "feat(documents): justified line layout with tinted values and blank lines"
```

---

### Task 4: Deploy and repo files for the private folder (TOUCHES DEPLOY CONFIG)

> This task edits `docker-compose.production.yml`, `Dockerfile.production` and `scripts/backup.sh`, which the production VM uses. Nothing is deployed or run on the VM here; the controller shows the user the exact lines below before the branch is deployed.

**Files:**
- Modify: `docker-compose.production.yml` (backend `volumes:` list; top-level `volumes:`)
- Modify: `Dockerfile.production` (the `RUN mkdir -p ./public/uploads ...` line in the runner stage)
- Modify: `scripts/backup.sh` (header comment, file names, a third tarball, rotation)
- Modify: `config/admin.ts` (`watchIgnoreFiles`)
- Modify: `.gitignore`, `.dockerignore`, `.env.example`
- Test: `src/club/documents/__tests__/deploy-files.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: in production the PDFs live in the named volume `private_documents`, mounted at `/opt/app/private`; the app writes to `/opt/app/private/documents` (the `PRIVATE_FILES_DIR` default, left unset in production); `scripts/backup.sh` writes `backups/documents-YYYY-MM-DD.tar.gz` nightly and keeps 14.

Why each change:
- Volume: the container's file system is rebuilt on every deploy; PDFs must survive it, like `uploads`.
- Dockerfile: Docker seeds a new named volume from the image path, including its owner. Without `./private/documents` owned by `strapi` (100:101) in the image, the first write fails with EACCES and `cap_drop: ALL` cannot fix it from inside (the same failure the uploads volume had).
- `config/admin.ts`: `strapi develop` restarts on any new file under the app folder unless ignored; every submit would restart the dev server.
- `.gitignore` / `.dockerignore`: the PDFs hold personal data; never in git, never baked into an image.

- [ ] **Step 1: Write the failing test**

`src/club/documents/__tests__/deploy-files.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

describe('documents: deploy and repo files', () => {
  it('keeps the PDFs out of git, the image and the dev watcher', () => {
    expect(read('.gitignore')).toMatch(/^private\/$/m);
    expect(read('.dockerignore')).toMatch(/^private$/m);
    expect(read('config/admin.ts')).toContain("'**/private/**'");
  });

  it('mounts a volume for them in production and backs it up nightly', () => {
    expect(read('docker-compose.production.yml')).toContain('- private_documents:/opt/app/private');
    expect(read('Dockerfile.production')).toContain('mkdir -p ./public/uploads ./private/documents && chown -R strapi:strapi ./public ./private');
    expect(read('scripts/backup.sh')).toContain('tar -C /opt/app -czf - private > "$DOCUMENTS_FILE"');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/club/documents/__tests__/deploy-files.test.ts`
Expected: FAIL (`.gitignore` has no `private/` line).

- [ ] **Step 3: Make the changes**

`docker-compose.production.yml`, in `services.backend`, replace

```yaml
    volumes:
      - uploads:/opt/app/public/uploads
```

with

```yaml
    volumes:
      - uploads:/opt/app/public/uploads
      # Registration PDFs (personal data), outside public/: served only by guarded routes.
      - private_documents:/opt/app/private
```

and at the end of the file replace

```yaml
volumes:
  pgdata:
  uploads:
```

with

```yaml
volumes:
  pgdata:
  uploads:
  private_documents:
```

`Dockerfile.production`, runner stage, replace

```dockerfile
RUN mkdir -p ./public/uploads && chown -R strapi:strapi ./public
```

with

```dockerfile
# Same for the private documents volume (registration PDFs, plan 2D).
RUN mkdir -p ./public/uploads ./private/documents && chown -R strapi:strapi ./public ./private
```

`scripts/backup.sh`: replace the header lines

```bash
# Produces two files per run, in ./backups/:
#   strapi-YYYY-MM-DD.sql.gz   - Postgres dump
#   uploads-YYYY-MM-DD.tar.gz  - public/uploads tarball
```

with

```bash
# Produces three files per run, in ./backups/:
#   strapi-YYYY-MM-DD.sql.gz     - Postgres dump
#   uploads-YYYY-MM-DD.tar.gz    - public/uploads tarball
#   documents-YYYY-MM-DD.tar.gz  - private/ tarball (registration PDFs)
```

after `UPLOADS_FILE="$BACKUP_DIR/uploads-$DATE.tar.gz"` add

```bash
DOCUMENTS_FILE="$BACKUP_DIR/documents-$DATE.tar.gz"
```

after the line `echo "  wrote $UPLOADS_FILE ($(du -h "$UPLOADS_FILE" | cut -f1))"` add

```bash

# Registration PDFs live in the private_documents volume, mounted at /opt/app/private.
docker compose -f docker-compose.production.yml exec -T backend \
  tar -C /opt/app -czf - private > "$DOCUMENTS_FILE"

echo "  wrote $DOCUMENTS_FILE ($(du -h "$DOCUMENTS_FILE" | cut -f1))"
```

and after the uploads rotation line add

```bash
ls -1t "$BACKUP_DIR"/documents-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm --
```

`config/admin.ts`, replace

```ts
  watchIgnoreFiles: ['**/.worktrees/**', '**/.superpowers/**'],
```

with

```ts
  // private/ holds the generated registration PDFs: writing one must not restart the dev server.
  watchIgnoreFiles: ['**/.worktrees/**', '**/.superpowers/**', '**/private/**'],
```

`.gitignore`, after `!public/uploads/.gitkeep` add

```
# Generated registration PDFs (personal data): never committed.
private/
```

`.dockerignore`, after `!public/uploads/.gitkeep` add

```

# Generated registration PDFs (personal data): never baked into an image.
private
```

`.env.example`, append

```
# ----- Registration PDFs (plan 2D) -----
# Signs the 24-hour download link on the registration success screen.
# Required in production (32+ characters): without it the form refuses
# registrations. Generate: openssl rand -base64 48
DOCUMENT_TOKEN_SECRET=
# Where the PDFs are stored. Leave empty in production: the default
# <app>/private/documents is the private_documents volume that
# scripts/backup.sh backs up.
PRIVATE_FILES_DIR=
```

- [ ] **Step 4: Run the checks**

Run: `npm test -- src/club/documents/__tests__/deploy-files.test.ts` (PASS, 2 tests), `bash -n scripts/backup.sh` (no output), `python3 -c "import yaml; yaml.safe_load(open('docker-compose.production.yml'))"` (no output), `npx tsc --noEmit` (zero errors).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.production.yml Dockerfile.production scripts/backup.sh config/admin.ts .gitignore .dockerignore .env.example \
  src/club/documents/__tests__/deploy-files.test.ts
git commit -m "chore(deploy): private documents volume, nightly backup and ignore rules for registration PDFs"
```

Deploy checklist for the controller (not done in this plan):
- The club confirms the legal numbers printed in the footer (C.I.F., C.I.S., registry no., IBAN, bank branch, `src/club/documents/association.ts`) before going live (user, 2026-10-21).
- `FRONTEND_ORIGIN` in the VM's `.env.production` starts with the public site address (it is already there for CORS); its first entry is where an expired download link is redirected (`/inscrieri/link-expirat`, page built by 2C). No new variable.
- Add `DOCUMENT_TOKEN_SECRET` (`openssl rand -base64 48`) to the VM's `.env.production` before deploying, or every registration is refused with 503.
- After the first deploy, check the volume is writable: `docker compose -f docker-compose.production.yml --env-file .env.production exec backend sh -c 'touch /opt/app/private/documents/.w && rm /opt/app/private/documents/.w'`.

---

### Task 5: Document wording

**Files:**
- Create: `src/club/documents/association.ts`, `src/club/documents/acord-content.ts`, `src/club/documents/adeziune-content.ts`
- Test: `src/club/documents/__tests__/content.test.ts`

**Interfaces:**
- Consumes: Task 2 (`DocumentValues`), Task 3 (`Run`, `t`, `b`, `bi`, `link`, `v`, `blank`, `runsText`).
- Produces:
  - `association.ts`: `ASSOCIATION_FOOTER = { seat, registration: string[3], account: string[2], contact: [label, value][4], legal }`, `FOOTER_TITLES`.
  - `acord-content.ts`: `ACORD_TITLE`, `REGULAMENT_LINK`, `type Clause = { letter; runs; bold }`, `type AcordContent = { intro; consent; clauses; marketing; closing }`, `acordPeriod(values)`, `acordContent(values): AcordContent`.
  - `adeziune-content.ts`: `ADEZIUNE_TITLE`, `ADEZIUNE_SUBTITLE`, `OFFICE` (president's box labels), `type AdeziuneContent = { intro; declarations: Run[][]; data }`, `adeziunePeriod(values)`, `adeziuneContent(values): AdeziuneContent`.

Sources, word for word:
- Acord: `edusport_frontend/docs/portal/mockups/screens/document-v4.html`, column "Propus" (`.d2`), with the approved changes: regulament link `www.scoaladepatinaj.com/cursuri/regulament` (2026-10-03) and the typo fixes "născut/ă", "să participe", "după caz", "Semnătura" (2026-10-05, decisions-1-5); period "octombrie 2026 – mai 2027" from the Sezon (2026-10-05: May, not June). Everything else, including "in calitate de", "Asociatia", "si accept", stays as written.
- Cerere de adeziune: `mockups/gen_adeziune.py`, function `adez()`, the club's own text (missing diacritics as on paper), with every cedilla s/t of the paper converted to ș/ț with the comma below (user, 2026-10-21, D3), as in "cunoștință", "Asociației", "Președinte". Filled only from the form: parent name, e-mail, phone, child name, birth date; address and CNP are blank lines; period and fee from the Sezon.
- Footer: `mockups/gen_legal3.py`, option B ("kvs"): columns `c1`, `c2x`, `c3x`, `contactKV(True)`, and the O.G. 26/2000 sentence (ș/ț with the comma below, D3). The association numbers there come from the club's paper Cerere (the photo in `documents-header-v1.html`); the IBAN checksum is valid. They are used as they are (D2); the club confirms them before going live (deploy checklist, Task 4).
- Blank widths: the mockups' own (`blank()` in `gen_adeziune.py`: max(60, min(150, 6 px per sample character)); the explicit `V(..., w)` widths of the Cerere).

- [ ] **Step 1: Write the failing test**

`src/club/documents/__tests__/content.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ACORD_TITLE, REGULAMENT_LINK, acordContent } from '../acord-content';
import { ADEZIUNE_TITLE, OFFICE, adeziuneContent } from '../adeziune-content';
import { ASSOCIATION_FOOTER } from '../association';
import { runsText } from '../runs';
import type { DocumentValues } from '../types';

const VALUES: DocumentValues = {
  registrationNumber: '2026-0142',
  parentName: 'Mihaela Dumitrescu',
  phone: '07xx xxx xxx',
  email: 'parinte@exemplu.ro',
  relationship: 'Părinte',
  childName: 'Maria Dumitrescu',
  birthDate: '14.03.2014',
  date: '03.10.2026',
  season: '2026-2027',
  periodStart: 'octombrie 2026',
  periodEnd: 'mai 2027',
  fee: '270 ron',
};
const acordText = () => {
  const c = acordContent(VALUES);
  return [c.intro, c.consent, ...c.clauses.map((cl) => cl.runs), c.marketing, c.closing].map(runsText).join(' ');
};

describe('Acord text (document-v4, DECISIONS 2026-10-03 and 2026-10-05)', () => {
  it('has the approved title and the 2026-10-05 typo fixes', () => {
    expect(ACORD_TITLE).toBe('Formular de înscriere – Școala de Patinaj EduSport');
    const text = acordText();
    expect(text).toContain('Maria Dumitrescu, născut/ă la data de 14.03.2014, doresc ca Maria Dumitrescu să participe la cursurile');
    expect(text).toContain('Regulamentele se completează, după caz, cu prevederile');
    for (const typo of ['nascut', 'sa particip/e', 'dupa caz']) expect(text).not.toContain(typo);
  });

  it('has clauses a to i, only f in bold, the regulament link in c and the Sezon period in g', () => {
    const { clauses } = acordContent(VALUES);
    expect(clauses.map((c) => c.letter)).toEqual(['a.', 'b.', 'c.', 'd.', 'e.', 'f.', 'g.', 'h.', 'i.']);
    expect(clauses.filter((c) => c.bold).map((c) => c.letter)).toEqual(['f.']);
    expect(clauses[2].runs).toContainEqual({ text: REGULAMENT_LINK, style: 'link' });
    expect(REGULAMENT_LINK).toBe('www.scoaladepatinaj.com/cursuri/regulament');
    expect(runsText(clauses[6].runs)).toContain('(octombrie 2026 – mai 2027)');
  });

  it('prints blank lines, not values, for missing answers', () => {
    const { intro } = acordContent({ ...VALUES, parentName: null, relationship: null });
    expect(intro[1]).toEqual({ blank: 108 });
    expect(intro[7]).toEqual({ blank: 60 });
  });
});

describe('Cerere de adeziune text (gen_adeziune.py)', () => {
  it('prefills only form answers; address and CNP are blank lines', () => {
    const { intro } = adeziuneContent(VALUES);
    expect(ADEZIUNE_TITLE).toBe('Cerere de adeziune');
    expect(runsText(intro)).toBe(
      'Subsemnatul/a Mihaela Dumitrescu cu domiciliul in localitatea , Strada , nr  Bl  Sc , Ap , Judet/Sector , CNP  e-mail parinte@exemplu.ro telefon 07xx xxx xxx in calitate de tutore al copilului Maria Dumitrescu, nascut la data de 14.03.2014, va solicit aderarea fiului/fiicei mele ca Membru sustinator al Asociatiei Clubul Sportiv EduSport.',
    );
    expect(intro.filter((r) => 'blank' in r)).toHaveLength(8);
  });

  it('reads the period and the annual fee from the Sezon', () => {
    const { declarations } = adeziuneContent(VALUES);
    expect(declarations).toHaveLength(6);
    expect(runsText(declarations[3])).toBe('Am luat la cunoștință faptul că în prezent cotizatia anuala aferenta perioadei octombrie 2026-mai 2027 este de 270 ron.');
  });
});

it('uses s and t with the comma below only (user, 2026-10-21)', () => {
  const cedilla = new RegExp(`[${String.fromCharCode(0x15e, 0x15f, 0x162, 0x163)}]`);
  const { intro, declarations, data } = adeziuneContent(VALUES);
  for (const runs of [intro, ...declarations, data]) expect(runsText(runs)).not.toMatch(cedilla);
  expect(ASSOCIATION_FOOTER.legal).not.toMatch(cedilla);
  expect(OFFICE.president).toBe('Președinte Asociatia Clubul Sportiv EduSport');
  expect(runsText(declarations[0])).toContain('am luat la cunoștință de prevederile Statutului și ale Actului Constitutiv ale Asociației');
});

it('the footer carries the association details of the approved mockups', () => {
  expect(ASSOCIATION_FOOTER.registration).toEqual(['C.I.F.: 30321550', 'C.I.S.: B/A2/00159/2012', 'nr. inreg. in Reg. Asoc. si Fundatiilor: 65/18.05.2012']);
  expect(ASSOCIATION_FOOTER.account[0]).toBe('RO89 INGB 0000 9999 0318 6729');
  expect(ASSOCIATION_FOOTER.legal).toContain('O.G. nr.26/2000');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/club/documents/__tests__/content.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/club/documents/association.ts`:

```ts
/**
 * The association's details printed in the 4-column footer of both documents (DECISIONS 2026-10-05,
 * legal-footer-v2 option B: links shortened). Copied word for word from the approved mockups
 * (edusport_frontend/docs/portal/mockups/gen_legal3.py, columns c1, c2x, c3x and contactKV(True)),
 * which took them from the club's paper Cerere de adeziune. The O.G. sentence uses s and t comma below
 * (user, 2026-10-21). The club confirms these numbers before going live (deploy checklist).
 */
export const ASSOCIATION_FOOTER = {
  seat: 'str. Slt. Stanescu Gheorghe, nr. 1, bl. 213, sc. A, et. 10, ap. 42, sect. 2, Bucuresti',
  registration: ['C.I.F.: 30321550', 'C.I.S.: B/A2/00159/2012', 'nr. inreg. in Reg. Asoc. si Fundatiilor: 65/18.05.2012'],
  account: ['RO89 INGB 0000 9999 0318 6729', 'deschis la ING Bank, sucursala Gara de Nord'],
  contact: [
    ['Telefon:', '0723.623.712'],
    ['E-mail:', 'edusporttrophy@gmail.com'],
    ['Facebook:', 'facebook.com/EduSportClub'],
    ['Web:', 'scoaladepatinaj.com'],
  ] as const,
  legal:
    'Asociația Clubul Sportiv EduSport este persoană juridică română de drept privat, fără scop patrimonial, polisportivă, apolitică și non-profit. Clubul Sportiv este constituit și funcționează în conformitate cu prevederile O.G. nr.26/2000 cu privire la asociatii si fundatii si a Legii Educatiei Fizice si Sportului nr.69/2000.',
} as const;

export const FOOTER_TITLES = ['Sediul social', 'Date de înregistrare', 'Cont', 'Contact'] as const;
```

`src/club/documents/acord-content.ts`:

```ts
import { b, bi, link, t, v, type Run } from './runs';
import type { DocumentValues } from './types';

/**
 * The Acord, word for word from mockups/screens/document-v4.html ("Propus"), with the
 * 2026-10-05 typo fixes ("născut/ă", "să participe", "după caz", "Semnătura") and the
 * regulament link of 2026-10-03. Blank widths are the mockup's blank() widths (gen_adeziune.py).
 */
export const ACORD_TITLE = 'Formular de înscriere – Școala de Patinaj EduSport';

export type Clause = { letter: string; runs: Run[]; bold: boolean };

export type AcordContent = {
  intro: Run[];
  consent: Run[];
  clauses: Clause[];
  marketing: Run[];
  closing: Run[];
};

/** "octombrie 2026 – mai 2027", as clause g prints it. */
export function acordPeriod(values: DocumentValues): string | null {
  return values.periodStart && values.periodEnd ? `${values.periodStart} – ${values.periodEnd}` : null;
}

function intro(x: DocumentValues): Run[] {
  return [
    t('Subsemnatul/a '), v(x.parentName, 108), t(', telefon '), v(x.phone, 72), t(', e-mail '), v(x.email, 108),
    t(', in calitate de '), v(x.relationship, 60), t(' al copilului '), v(x.childName, 96),
    t(', născut/ă la data de '), v(x.birthDate, 60), t(', doresc ca '), v(x.childName, 96),
    t(' să participe la cursurile organizate de Asociatia Clubul Sportiv EduSport.'),
  ];
}

function consent(x: DocumentValues): Run[] {
  return [
    t('Îmi exprim acordul liber, informat și necondiționat pentru participarea '), v(x.childName, 96),
    t(' la activitățile organizate de Asociația Clubul Sportiv EduSport. '),
    bi('De asemenea, declar că am acordul expres al celuilalt părinte pentru participarea la cursuri si accept următoarele responsabilități și condiții de participare:'),
  ];
}

const plain = (letter: string, text: string): Clause => ({ letter, runs: [t(text)], bold: false });

const CLAUSE_A = 'Declar pe propria răspundere, în calitate de cursant sau părinte/tutore legal, că participantul la curs este sănătos din punct de vedere medical și apt pentru efort fizic intens. Prin prezenta, exonerez Asociația Clubul Sportiv EduSport, antrenorii, instructorii, angajații, colaboratorii și partenerii patinoarului de orice responsabilitate legată de participarea mea sau a copilului meu la activitățile sportive desfășurate.';
const CLAUSE_B = 'Sunt conștient(ă) că participarea la cursurile și evenimentele de patinaj implică riscuri specifice acestui sport, inclusiv posibilitatea unor accidentări. Deși ACS EduSport și patinoarul partener iau măsuri pentru a asigura un mediu cât mai sigur, nu pot garanta eliminarea completă a pericolelor. Prin urmare, accept că ACS EduSport nu poate fi tras la răspundere pentru eventuale incidente sau răniri apărute în timpul activităților.';
const CLAUSE_C = 'În calitate de cursant, părinte sau tutore legal, înțeleg importanța respectării regulilor de conduită și a indicațiilor oferite de antrenori, atât pentru siguranța proprie, cât și pentru buna desfășurare a activităților. Mă angajez să urmez aceste reguli cu responsabilitate și să mă asigur că fiul/fiica mea cooperează cu personalul clubului, respectă instrucțiunile primite în timpul cursurilor, regulile patinoarului și regulamentul oficial al ACS EduSport, disponibil la ';
const CLAUSE_D = 'Înțeleg că nerespectarea regulilor sau orice comportament din partea cursantului ori a tutorelui care perturbă desfășurarea cursurilor poate conduce la excluderea cursantului din programul de patinaj și la retragerea calității de membru al clubului, fără obligația de a restitui sumele achitate.';
const CLAUSE_E = 'Înțeleg că, în cazul în care cursantul provoacă daune sau deteriorări în incinta patinoarului, responsabilitatea revine exclusiv acestuia. Asociația Clubul Sportiv EduSport nu poate fi considerată răspunzătoare pentru astfel de prejudicii.';
const CLAUSE_F = 'Înțeleg că abonamentele sunt valabile timp de 4 săptămâni de la data primei ședințe, iar ședințele achitate care nu sunt efectuate nu pot fi recuperate sau reportate.';
const CLAUSE_H = 'Intervalul orar al cursurilor poate suferi modificări în funcție de evenimentele organizate de patinoar sau de alte situații care impun reprogramarea activităților de către organizator.';
const CLAUSE_I = 'Asociația Clubul Sportiv EduSport își rezervă dreptul de a fotografia și înregistra audio-video antrenamentele, cursurile, spectacolele sau orice alt eveniment organizat de ACS EduSport ori de partenerii săi, în care apar cursanți sau sportivi ai clubului. Imaginile și înregistrările pot fi utilizate în scopul promovării activității ACS EduSport.';
export const REGULAMENT_LINK = 'www.scoaladepatinaj.com/cursuri/regulament';

function clauses(x: DocumentValues): Clause[] {
  return [
    plain('a.', CLAUSE_A),
    plain('b.', CLAUSE_B),
    { letter: 'c.', runs: [t(CLAUSE_C), link(REGULAMENT_LINK), t(' Regulamentele se completează, după caz, cu prevederile legale în vigoare.')], bold: false },
    plain('d.', CLAUSE_D),
    plain('e.', CLAUSE_E),
    { letter: 'f.', runs: [b(CLAUSE_F)], bold: true },
    {
      letter: 'g.',
      runs: [t('Tarifele pot suferi modificări pe durata acordului ('), v(acordPeriod(x), 150), t('), cu informarea prealabilă a participanților cu minimum 30 de zile înainte.')],
      bold: false,
    },
    plain('h.', CLAUSE_H),
    plain('i.', CLAUSE_I),
  ];
}

const MARKETING: Run[] = [
  t('Îmi exprim acordul ca datele mele personale și de contact să fie utilizate, timp de 1 an de la completarea prezentei cereri, pentru transmiterea de materiale informative și notificări legate de activitatea Asociației Clubul Sportiv EduSport. Confirm că am citit Politica de Confidențialitate privind prelucrarea datelor cu caracter personal ale persoanelor fizice, disponibilă la '),
  b('scoaladepatinaj.com/protectia-datelor'),
  t(', și îmi exprim consimțământul pentru furnizarea și prelucrarea acestor date conform celor menționate.'),
];

const CLOSING: Run[] = [bi('Prin prezenta, confirm că am citit și accept conținutul acestui document și îmi asum toate declarațiile incluse.')];

export function acordContent(values: DocumentValues): AcordContent {
  return { intro: intro(values), consent: consent(values), clauses: clauses(values), marketing: MARKETING, closing: CLOSING };
}
```

`src/club/documents/adeziune-content.ts`:

```ts
import { blank, link, t, v, type Run } from './runs';
import type { DocumentValues } from './types';

/**
 * The Cerere de adeziune, word for word from mockups/gen_adeziune.py (adez()), the club's own text
 * (missing diacritics included), with s and t comma below everywhere (user, 2026-10-21: the paper's
 * cedilla letters are converted). Prefilled only from the form answers; address and CNP stay blank
 * lines for paper (DECISIONS 2026-10-05). Blank widths are the mockup's V(...) widths.
 */
export const ADEZIUNE_TITLE = 'Cerere de adeziune';
export const ADEZIUNE_SUBTITLE = 'pentru a deveni Membru sustinator al Asociatiei Clubul Sportiv EduSport';

export type AdeziuneContent = { intro: Run[]; declarations: Run[][]; data: Run[] };

/** "octombrie 2026-mai 2027", as clause 4 prints it. */
export function adeziunePeriod(values: DocumentValues): string | null {
  return values.periodStart && values.periodEnd ? `${values.periodStart}-${values.periodEnd}` : null;
}

function intro(x: DocumentValues): Run[] {
  return [
    t('Subsemnatul/a '), v(x.parentName, 130), t(' cu domiciliul in localitatea '), blank(90), t(', Strada '), blank(110),
    t(', nr '), blank(26), t(' Bl '), blank(26), t(' Sc '), blank(22), t(', Ap '), blank(22), t(', Judet/Sector '), blank(70),
    t(', CNP '), blank(110), t(' e-mail '), v(x.email, 120), t(' telefon '), v(x.phone, 80),
    t(' in calitate de tutore al copilului '), v(x.childName, 130), t(', nascut la data de '), v(x.birthDate, 60),
    t(', va solicit aderarea fiului/fiicei mele ca Membru sustinator al Asociatiei Clubul Sportiv EduSport.'),
  ];
}

const STATUTE = 'Declar pe propria răspundere că am luat la cunoștință de prevederile Statutului și ale Actului Constitutiv ale Asociației pe care le accept fără rezerve, îndeplinesc condițiile necesare pentru a obține statutul de Membru al său, mă angajez să acționez pentru realizarea scopului și obiectivelor Asociației și să respect hotărârile / deciziile conducerii acesteia. Mă voi abține de la orice acțiune care dăunează prestigiului și intereselor Asociației Clubul Sportiv EduSport. Ma angajez sa nu demarez actiuni si/sau luari de pozitie in numele Asocatiei fara a anunta in prealabil conducerea Asociatiei si fara a avea acordul scris al acesteia.';
const FEE_DUTY = 'Mă angajez să achit cotizația anuală stabilită de către Adunarea Generală a Asociației Clubul Sportiv EduSport. Înțeleg că neplata cotizației anuale conform Actului Constitutiv și a Statutului Asociației reprezintă dreptul acesteia de a exclude persoana fizică dintre membrii săi.';
const MEDIA = 'Am luat la cunoștință faptul că Asociația Clubul Sportiv EduSport își rezervă dreptul de a fotografia și înregistra audio-video antrenamentele, cursurile, serbările/spectacolele sau orice alt eveniment organizat de ACS EduSport ori de partenerii acestuia, în care apar membrii, cursanții sau sportivii ACS EduSport, precum și de a utiliza imaginile/filmările în scopul promovării activității ACS EduSport.';
const NEWS = 'Sunt de acord ca datele cu caracter personal și datele mele de contact să fie utilizate pentru a primi materiale informative și/sau înștiințări cu privire la activitatea Asociației Clubul Sportiv EduSport.';
const DATA_USE = 'imi exprim acordul cu privire la utilizarea și prelucrarea datelor mele cu caracter personal de către Asociatia Clubul Sportiv EduSport, cu sediul social: str. Slt. Stanescu Gheorghe, nr. 1, bl. 213, sc. A, et. 10, ap. 42, sect. 2, Bucurest, CIF: 30321550.';

function declarations(x: DocumentValues): Run[][] {
  const fee = [
    t('Am luat la cunoștință faptul că în prezent cotizatia anuala aferenta perioadei '), v(adeziunePeriod(x), 130),
    t(' este de '), v(x.fee, 40), t('.'),
  ];
  return [[t(STATUTE)], [t(FEE_DUTY)], [t(MEDIA)], fee, [t(NEWS)], [t(DATA_USE)]];
}

const DATA: Run[] = [
  t('Acestea vor fi folosite în scopul îndeplinirii obiectivelor ACS EduSport, cu respectarea prevederilor legale, conform regulamentului disponibil pe '),
  link('https://scoaladepatinaj.com/protectia-datelor/'),
];

export const OFFICE = {
  registered: 'Cererea a fost înregistrată cu nr',
  member: 'Membru:',
  admitted: 'admis',
  rejected: 'respins',
  president: 'Președinte Asociatia Clubul Sportiv EduSport',
} as const;

export function adeziuneContent(values: DocumentValues): AdeziuneContent {
  return { intro: intro(values), declarations: declarations(values), data: DATA };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/club/documents/__tests__/content.test.ts`
Expected: PASS (7 tests). Then `npx tsc --noEmit`: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/documents/association.ts src/club/documents/acord-content.ts src/club/documents/adeziune-content.ts \
  src/club/documents/__tests__/content.test.ts
git commit -m "feat(documents): Acord and Cerere de adeziune wording, word for word from the approved mockups"
```

---

### Task 6: Private storage and the 24-hour download token

**Files:**
- Create: `src/club/documents/storage.ts`, `src/club/documents/token.ts`
- Test: `src/club/documents/__tests__/storage.test.ts`, `src/club/documents/__tests__/token.test.ts`

**Interfaces:**
- Consumes: Task 2 (`DocumentKind`, `StoredDocument`, `kindFromFileName`).
- Produces:
  - `storage.ts`: `documentsRoot(appRoot, env?)` (env `PRIVATE_FILES_DIR`, default `<appRoot>/private/documents`), `isSafeDocumentId(id): id is string` (`/^[a-z0-9]{10,64}$/`, Strapi 5 document ids), `registrationDir(root, id)` (`<root>/registrations/<id>`, throws on an unsafe id), `listStored(dir): Promise<StoredDocument[]>`, `removeStored(dir): Promise<void>` (deletes the folder; nothing there is fine), `type NewFile = { kind; fileName; data: Buffer }`, `replaceStored(dir, files): Promise<StoredDocument[]>`.
  - `token.ts`: `DOWNLOAD_TOKEN_TTL_MS` (24 h), `class DocumentTokenSecretMissingError`, `documentTokenSecret(env?): string | null`, `createDownloadToken(registrationDocumentId, now?): string`, `verifyDownloadToken(token, now?): { registrationDocumentId } | null`.

Rules: write the new files first (each through a temporary file and a rename, mode 0600), then delete the files no longer in the set; a failed write throws before anything is deleted (DECISIONS 2026-10-05). Token = `base64url("<id>.<expiresAtMs>") + "." + base64url(HMAC-SHA256)`, compared in constant time. Secret: `DOCUMENT_TOKEN_SECRET`, at least 32 characters; in production a missing or short secret gives `null` (fail closed: no token is made and none verifies); outside production a fixed local key is used so local runs work without setup.

- [ ] **Step 1: Write the failing tests**

`src/club/documents/__tests__/storage.test.ts`:

```ts
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { documentsRoot, isSafeDocumentId, listStored, registrationDir, removeStored, replaceStored } from '../storage';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'edusport-docs-'));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const ID = 'reg0000000000000000000001';
const pdf = (text: string) => Buffer.from(`%PDF-1.7 ${text}`);

describe('private document storage', () => {
  it('lives in PRIVATE_FILES_DIR, or <app>/private/documents by default', () => {
    expect(documentsRoot('/opt/app', {})).toBe('/opt/app/private/documents');
    expect(documentsRoot('/opt/app', { PRIVATE_FILES_DIR: '/data/docs' })).toBe('/data/docs');
  });

  it('never builds a path from an unsafe id', () => {
    expect(isSafeDocumentId(ID)).toBe(true);
    for (const bad of ['../../etc', 'abc', 'REG0000000000000000000001', '', null]) expect(isSafeDocumentId(bad)).toBe(false);
    expect(() => registrationDir(root, '../x/../../y')).toThrow('Invalid registration id');
  });

  it('lists nothing for a registration without documents', async () => {
    await expect(listStored(registrationDir(root, ID))).resolves.toEqual([]);
  });

  it('replaces the set: same name overwritten, files no longer in the set deleted', async () => {
    const dir = registrationDir(root, ID);
    await replaceStored(dir, [
      { kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: pdf('old acord') },
      { kind: 'adeziune', fileName: 'Ana_Pop_Adeziune_2026-2027.pdf', data: pdf('old cerere') },
    ]);
    const stored = await replaceStored(dir, [{ kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: pdf('new acord') }]);
    expect(stored).toEqual([{ kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', path: path.join(dir, 'Ana_Pop_Acord_2026-2027.pdf') }]);
    expect(await fs.readdir(dir)).toEqual(['Ana_Pop_Acord_2026-2027.pdf']);
    expect(await fs.readFile(stored[0].path, 'utf8')).toBe('%PDF-1.7 new acord');
  });

  it('a renamed child gets the new file and loses the old one', async () => {
    const dir = registrationDir(root, ID);
    await replaceStored(dir, [{ kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: pdf('a') }]);
    await replaceStored(dir, [{ kind: 'acord', fileName: 'Ana_Popescu_Acord_2026-2027.pdf', data: pdf('b') }]);
    expect((await listStored(dir)).map((d) => d.fileName)).toEqual(['Ana_Popescu_Acord_2026-2027.pdf']);
  });

  it('keeps the old files when a new one cannot be written', async () => {
    const dir = registrationDir(root, ID);
    await replaceStored(dir, [{ kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: pdf('old') }]);
    await fs.mkdir(path.join(dir, 'Ana_Pop_Adeziune_2026-2027.pdf')); // a folder in the way: the rename fails
    await expect(
      replaceStored(dir, [
        { kind: 'adeziune', fileName: 'Ana_Pop_Adeziune_2026-2027.pdf', data: pdf('new') },
        { kind: 'acord', fileName: 'Ana_Popescu_Acord_2026-2027.pdf', data: pdf('new') },
      ]),
    ).rejects.toThrow();
    expect(await fs.readFile(path.join(dir, 'Ana_Pop_Acord_2026-2027.pdf'), 'utf8')).toBe('%PDF-1.7 old');
    expect((await fs.readdir(dir)).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });

  it('removes a registration folder, and does nothing when it is already gone', async () => {
    const dir = registrationDir(root, ID);
    await replaceStored(dir, [{ kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: pdf('a') }]);
    await removeStored(dir);
    await expect(fs.access(dir)).rejects.toThrow();
    await expect(removeStored(dir)).resolves.toBeUndefined();
  });
});
```

`src/club/documents/__tests__/token.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOWNLOAD_TOKEN_TTL_MS, DocumentTokenSecretMissingError, createDownloadToken, documentTokenSecret, verifyDownloadToken } from '../token';

const ID = 'reg0000000000000000000001';
const OTHER = 'reg0000000000000000000002';
const NOW = new Date('2026-10-20T10:00:00.000Z');
const SECRET = 'a-test-secret-that-is-at-least-32-characters-long';

afterEach(() => vi.unstubAllEnvs());

describe('24-hour download token', () => {
  it('opens the registration it was made for, until 24 hours later', () => {
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', SECRET);
    const token = createDownloadToken(ID, NOW);
    expect(verifyDownloadToken(token, NOW)).toEqual({ registrationDocumentId: ID });
    expect(verifyDownloadToken(token, new Date(NOW.getTime() + DOWNLOAD_TOKEN_TTL_MS - 1))).toEqual({ registrationDocumentId: ID });
  });

  it('is refused once expired', () => {
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', SECRET);
    const token = createDownloadToken(ID, NOW);
    expect(verifyDownloadToken(token, new Date(NOW.getTime() + DOWNLOAD_TOKEN_TTL_MS))).toBeNull();
  });

  it('cannot be changed to open another registration', () => {
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', SECRET);
    const [, signature] = createDownloadToken(ID, NOW).split('.');
    const forged = `${Buffer.from(`${OTHER}.${NOW.getTime() + DOWNLOAD_TOKEN_TTL_MS}`).toString('base64url')}.${signature}`;
    expect(verifyDownloadToken(forged, NOW)).toBeNull();
  });

  it('is refused when signed with another secret, or malformed', () => {
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', SECRET);
    const token = createDownloadToken(ID, NOW);
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', `${SECRET}-rotated`);
    expect(verifyDownloadToken(token, NOW)).toBeNull();
    for (const bad of ['', 'abc', 'a.b.c', null, 42]) expect(verifyDownloadToken(bad, NOW)).toBeNull();
  });

  it('fails closed in production without a secret (32+ characters)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', 'too-short');
    expect(documentTokenSecret()).toBeNull();
    expect(() => createDownloadToken(ID, NOW)).toThrow(DocumentTokenSecretMissingError);
    expect(verifyDownloadToken('x.y', NOW)).toBeNull();
  });

  it('works locally without a secret', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', '');
    expect(verifyDownloadToken(createDownloadToken(ID, NOW), NOW)).toEqual({ registrationDocumentId: ID });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- src/club/documents/__tests__/storage.test.ts src/club/documents/__tests__/token.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/club/documents/storage.ts`:

```ts
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { kindFromFileName } from './format';
import type { DocumentKind, StoredDocument } from './types';

/**
 * Private documents folder: env PRIVATE_FILES_DIR, default <app>/private/documents.
 * Outside public/, so Strapi never serves it; files open only through the guarded routes.
 */
export function documentsRoot(appRoot: string, env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.PRIVATE_FILES_DIR ?? '').trim();
  return configured ? path.resolve(configured) : path.join(appRoot, 'private', 'documents');
}

/** Strapi document ids are lowercase letters and digits; anything else never reaches the file system. */
export function isSafeDocumentId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]{10,64}$/.test(id);
}

export function registrationDir(root: string, registrationDocumentId: string): string {
  if (!isSafeDocumentId(registrationDocumentId)) throw new Error('Invalid registration id');
  return path.join(root, 'registrations', registrationDocumentId);
}

/** The PDFs stored for one registration (no folder yet: none). */
export async function listStored(dir: string): Promise<StoredDocument[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const docs: StoredDocument[] = [];
  for (const fileName of names.sort()) {
    const kind = kindFromFileName(fileName);
    if (kind) docs.push({ kind, fileName, path: path.join(dir, fileName) });
  }
  return docs;
}

/** Deletes a registration's folder and its PDFs; nothing to delete is fine (idempotent). */
export async function removeStored(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

export type NewFile = { kind: DocumentKind; fileName: string; data: Buffer };

/** Writes `data` to `target` through a temporary file in the same folder, so a reader never sees half a PDF. */
async function writeAtomically(target: string, data: Buffer): Promise<void> {
  const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temp, data, { mode: 0o600 });
    await fs.rename(temp, target);
  } catch (err) {
    await fs.rm(temp, { force: true });
    throw err;
  }
}

/**
 * Stores a registration's new set of PDFs: every new file is written first, then the files that are
 * no longer part of the set (renamed child, membership changed to Nu) are deleted. A failed write
 * leaves the old files in place (DECISIONS 2026-10-05).
 */
export async function replaceStored(dir: string, files: NewFile[]): Promise<StoredDocument[]> {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  for (const file of files) await writeAtomically(path.join(dir, file.fileName), file.data);
  const keep = new Set(files.map((f) => f.fileName));
  for (const old of await listStored(dir)) {
    if (!keep.has(old.fileName)) await fs.rm(old.path, { force: true });
  }
  return files.map((f) => ({ kind: f.kind, fileName: f.fileName, path: path.join(dir, f.fileName) }));
}
```

`src/club/documents/token.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isSafeDocumentId } from './storage';

/** The success-screen download link works for 24 hours (spec 3.4); after that the PDF is in the e-mail. */
export const DOWNLOAD_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const DEV_SECRET = 'edusport-local-document-token-secret-not-for-production';

export class DocumentTokenSecretMissingError extends Error {
  constructor() {
    super('DOCUMENT_TOKEN_SECRET is not set (at least 32 characters required in production)');
    this.name = 'DocumentTokenSecretMissingError';
  }
}

/** The HMAC key: env DOCUMENT_TOKEN_SECRET (32+ chars). Outside production a fixed local key is used when unset. */
export function documentTokenSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = (env.DOCUMENT_TOKEN_SECRET ?? '').trim();
  if (secret.length >= 32) return secret;
  return env.NODE_ENV === 'production' ? null : DEV_SECRET;
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

/** `<base64url(id.expiresAtMs)>.<hmac>`: names one registration, expires 24 h after `now`. */
export function createDownloadToken(registrationDocumentId: string, now: Date = new Date()): string {
  const secret = documentTokenSecret();
  if (!secret) throw new DocumentTokenSecretMissingError();
  if (!isSafeDocumentId(registrationDocumentId)) throw new Error('Invalid registration id');
  const payload = Buffer.from(`${registrationDocumentId}.${now.getTime() + DOWNLOAD_TOKEN_TTL_MS}`).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

function signatureMatches(payload: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The registration a token names, or null when it is malformed, forged, or older than 24 hours. */
export function verifyDownloadToken(token: unknown, now: Date = new Date()): { registrationDocumentId: string } | null {
  const secret = documentTokenSecret();
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (!secret || parts.length !== 2 || !signatureMatches(parts[0], parts[1], secret)) return null;
  const [id, expires] = Buffer.from(parts[0], 'base64url').toString('utf8').split('.');
  if (!isSafeDocumentId(id) || !(Number(expires) > now.getTime())) return null;
  return { registrationDocumentId: id };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -- src/club/documents/__tests__/storage.test.ts src/club/documents/__tests__/token.test.ts`
Expected: PASS (13 tests). Then `npx tsc --noEmit`: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/documents/storage.ts src/club/documents/token.ts \
  src/club/documents/__tests__/storage.test.ts src/club/documents/__tests__/token.test.ts
git commit -m "feat(documents): private PDF storage (new files first, removal) and 24-hour signed download token"
```

---

### Task 7: PDF drawing

**Files:**
- Create: `src/club/documents/pdf/style.ts`, `pdf/draw.ts`, `pdf/blocks.ts`, `pdf/frame.ts`, `pdf/acord.ts`, `pdf/adeziune.ts`, `pdf/render.ts`
- Create (test helper): `src/club/documents/__tests__/pdf-text.ts`
- Test: `src/club/documents/__tests__/render.test.ts`

**Interfaces:**
- Consumes: Task 1 (pdfkit, fonts, unpdf), Task 2 (`DocumentKind`, `DocumentValues`, `registrationValues`, `blankValues`), Task 3 (`Run`, `TextStyle`, `layoutParagraph`, `Measure`, `PlacedRun`), Task 5 (all content exports).
- Produces:
  - `renderDocument(kind: DocumentKind, values: DocumentValues): Promise<Buffer>` (`pdf/render.ts`): one A4 page; `null` values print blank lines.
  - `BODY_SCALES` (`[1, 0.96, 0.92, 0.88, 0.85, 0.82, 0.8]`), `DocumentOverflowError` (`pdf/blocks.ts`), `registerFonts`, `FONT` (`pdf/style.ts`).

Geometry (from `.d2` in `document-v4.html` and `gen_legal3.py`): the mockup page is 560 px wide, A4 is 595.28 pt, so 1 px = 1.063 pt; padding 28/40/18 px; body Inter 8.3 px, line-height 1.4, justified; title Inter bold 13.5 px navy; header "CLUBUL SPORTIV" 7.5 px bold letter-spacing .34em over EDUSPORT (Climate Crisis 20 px), Sezonul and Nr. înscriere right-aligned 8.5 px, 2 px navy rule; clause letters Inter 800 `#be3330` in a 14 px column; marketing consent framed with real 10 px Da / Nu boxes; Data (bold 11 px, or a 60 px blank line) and a Semnătura line; footer: 4 columns `1fr 1.05fr 1fr 1.35fr`, gap 14 px, titles 6.6 px uppercase, text 7.2 px, then the O.G. sentence 7 px grey, pinned to the bottom. The Contact column is never narrower than its longest label + value, like a CSS grid track (otherwise `facebook.com/EduSportClub` runs past the margin). On the Cerere the president's box stretches to the signatures' height.

Why the body may shrink: the approved Acord (document-v4, 792 px tall with the site-only footer) plus the approved 4-column footer (legal-footer-v2 B) measures 885 px in Chrome, more than one A4 page. The header, title and footer keep the mockups' sizes; the body is drawn scaled (`doc.scale`, with a proportionally wider column, so lines still fill the page width) at the first of `BODY_SCALES` that fits. With the mockups' sample, the Acord fits at 0.88 (body about 7.8 pt) and the Cerere at 1. A body that does not fit even at 0.8 throws `DocumentOverflowError`. Rendering the Acord takes about 0.4 s (a few attempts), the Cerere about 0.07 s. The user accepted the shrunk body with the full footer (D1, 2026-10-21).

- [ ] **Step 1: Write the failing test**

The test also pins D3: no cedilla s/t (U+015E, U+015F, U+0162, U+0163) anywhere in either document, filled or blank. The helper collapses whitespace and drops the space pdf.js puts before punctuation that follows a value (it extracts each styled run separately: `Dumitrescu , telefon`).

`src/club/documents/__tests__/pdf-text.ts`:

```ts
import { extractText, getDocumentProxy } from 'unpdf';

/** The text of a PDF as one string: whitespace collapsed, no space before punctuation (pdf.js splits runs). */
export async function pdfText(pdf: Buffer): Promise<{ pages: number; text: string }> {
  const proxy = await getDocumentProxy(new Uint8Array(pdf));
  const { totalPages, text } = await extractText(proxy, { mergePages: true });
  const clean = text
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:)])/g, '$1')
    .replace(/\( /g, '(');
  return { pages: totalPages, text: clean };
}
```

`src/club/documents/__tests__/render.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderDocument } from '../pdf/render';
import type { DocumentSeason } from '../types';
import { blankValues, registrationValues } from '../values';
import { pdfText } from './pdf-text';

// Each Acord render tries a few body sizes (about 0.4 s alone, several seconds when the whole suite runs in parallel).
vi.setConfig({ testTimeout: 30_000 });

const SEASON: DocumentSeason = { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270 };
const ROW = {
  documentId: 'reg0000000000000000000001',
  registrationNumber: '2026-0142',
  parentName: 'Mihaela Dumitrescu',
  phone: '0723 456 789',
  email: 'parinte@exemplu.ro',
  relationship: 'parinte',
  childName: 'Ștefania Țăranu-Bâlă',
  childBirthDate: '2014-03-14',
  membershipAnswer: 'da',
  submittedAt: '2026-10-03T08:00:00.000Z',
};
const FILLED = registrationValues(ROW, SEASON);
const LONG = registrationValues(
  {
    ...ROW,
    parentName: 'Alexandra-Maria Constantinescu-Dumitrescu Popescu',
    email: 'alexandra.maria.constantinescu.dumitrescu@exemplu-foarte-lung.ro',
    relationship: 'alta',
    relationshipOther: 'Bunică din partea mamei, cu acordul ambilor părinți',
    childName: 'Ștefan-Alexandru Constantinescu-Dumitrescu Popescu',
  },
  SEASON,
);

describe('Acord PDF', () => {
  it('is one A4 page with the approved text, the typo fixes and the Romanian letters', async () => {
    const { pages, text } = await pdfText(await renderDocument('acord', FILLED));
    expect(pages).toBe(1);
    expect(text).toContain('Formular de înscriere – Școala de Patinaj EduSport');
    expect(text).toContain('Sezonul 2026-2027');
    expect(text).toContain('Nr. înscriere 2026-0142');
    expect(text).toContain('Subsemnatul/a Mihaela Dumitrescu, telefon 0723 456 789, e-mail parinte@exemplu.ro, in calitate de Părinte al copilului Ștefania Țăranu-Bâlă, născut/ă la data de 14.03.2014, doresc ca Ștefania Țăranu-Bâlă să participe la cursurile');
    expect(text).toContain('disponibil la www.scoaladepatinaj.com/cursuri/regulament Regulamentele se completează, după caz, cu prevederile legale în vigoare.');
    expect(text).toContain('Tarifele pot suferi modificări pe durata acordului (octombrie 2026 – mai 2027), cu informarea prealabilă');
    expect(text).toContain('Înțeleg că abonamentele sunt valabile timp de 4 săptămâni de la data primei ședințe');
    expect(text).toContain('Prin prezenta, confirm că am citit și accept conținutul acestui document și îmi asum toate declarațiile incluse.');
    expect(text).toContain('DATA SEMNĂTURA 03.10.2026');
    expect(text).toMatch(/ș.*ț.*ă.*î.*â/s);
    for (const typo of ['nascut', 'sa particip/e', 'dupa caz', 'Semnatura', 'SEMNATURA']) expect(text).not.toContain(typo);
  });

  it('carries the 4-column legal footer and the O.G. 26/2000 sentence', async () => {
    const { text } = await pdfText(await renderDocument('acord', FILLED));
    // the column titles are letter-spaced, so pdf.js splits their letters
    expect(text.replace(/ /g, '')).toContain('SEDIULSOCIALDATEDEÎNREGISTRARECONTCONTACT');
    for (const part of ['C.I.F.: 30321550', 'C.I.S.: B/A2/00159/2012', 'RO89 INGB 0000 9999 0318 6729', 'Facebook: facebook.com/EduSportClub', 'O.G. nr.26/2000']) {
      expect(text).toContain(part);
    }
  });

  it('stays one page with very long answers', async () => {
    const { pages, text } = await pdfText(await renderDocument('acord', LONG));
    expect(pages).toBe(1);
    expect(text).toContain('Bunică din partea mamei');
  });

  it('an old registration (no Sezon link, no relationship, no number) still gets a one-page Acord with blank lines', async () => {
    const old = registrationValues({ documentId: 'reg0000000000000000000003', parentName: 'Părinte Vechi', childName: 'Copil Vechi', season: '2025-2026' }, null);
    const { pages, text } = await pdfText(await renderDocument('acord', old));
    expect(pages).toBe(1);
    expect(text).toContain('Sezonul 2025-2026');
    expect(text).toContain('Subsemnatul/a Părinte Vechi, telefon, e-mail, in calitate de al copilului Copil Vechi');
  });

  it('blank form: season and period printed, no personal data, no number, no date', async () => {
    const { pages, text } = await pdfText(await renderDocument('acord', blankValues(SEASON)));
    expect(pages).toBe(1);
    expect(text).toContain('Sezonul 2026-2027');
    expect(text).toContain('(octombrie 2026 – mai 2027)');
    expect(text).not.toMatch(/2026-0\d{3}|03\.10\.2026|Dumitrescu/);
  });
});

/** s and t with a cedilla (U+015E, U+015F, U+0162, U+0163): the documents use the comma below only. */
const CEDILLA = new RegExp(`[${String.fromCharCode(0x15e, 0x15f, 0x162, 0x163)}]`);

describe('Romanian letters', () => {
  it('prints s and t with the comma below only, in both documents and the blank forms (user, 2026-10-21)', async () => {
    for (const kind of ['acord', 'adeziune'] as const) {
      for (const values of [FILLED, blankValues(SEASON)]) {
        const { text } = await pdfText(await renderDocument(kind, values));
        expect(text).not.toMatch(CEDILLA);
        expect(text).toContain('Asociația Clubul Sportiv EduSport este persoană juridică');
      }
    }
  });
});

describe('Cerere de adeziune PDF', () => {
  it('is one page, prefilled only from the form; address and CNP stay blank', async () => {
    const { pages, text } = await pdfText(await renderDocument('adeziune', FILLED));
    expect(pages).toBe(1);
    expect(text).toContain('Cerere de adeziune pentru a deveni Membru sustinator al Asociatiei Clubul Sportiv EduSport');
    expect(text).toContain('Subsemnatul/a Mihaela Dumitrescu cu domiciliul in localitatea, Strada, nr Bl Sc, Ap, Judet/Sector, CNP e-mail parinte@exemplu.ro telefon 0723 456 789 in calitate de tutore al copilului Ștefania Țăranu-Bâlă, nascut la data de 14.03.2014');
    expect(text).toContain('cotizatia anuala aferenta perioadei octombrie 2026-mai 2027 este de 270 ron.');
    expect(text).toContain('Cererea a fost înregistrată cu nr / Membru: admis respins Președinte Asociatia Clubul Sportiv EduSport');
    expect(text).toContain('O.G. nr.26/2000');
  });

  it('blank form: period and fee printed, nothing personal', async () => {
    const { pages, text } = await pdfText(await renderDocument('adeziune', blankValues(SEASON)));
    expect(pages).toBe(1);
    expect(text).toContain('perioadei octombrie 2026-mai 2027 este de 270 ron.');
    expect(text).not.toMatch(/Mihaela|parinte@|2026-0142/);
  });

  it('stays one page with very long answers', async () => {
    expect((await pdfText(await renderDocument('adeziune', LONG))).pages).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/club/documents/__tests__/render.test.ts`
Expected: FAIL (module `../pdf/render` not found).

- [ ] **Step 3: Implement**

`src/club/documents/pdf/style.ts`:

```ts
import path from 'node:path';
import type { TextStyle } from '../runs';

/**
 * Page geometry and type from the approved mockups (.d2 in document-v4.html, gen_legal3.py):
 * the mockup page is 560 px wide, A4 is 595.28 pt, so 1 mockup px = S pt.
 */
export const PAGE = { width: 595.28, height: 841.89 } as const;
export const S = PAGE.width / 560;
export const px = (n: number) => n * S;

export const MARGIN = { top: px(28), side: px(40), bottom: px(18) } as const;
export const CONTENT_WIDTH = PAGE.width - 2 * MARGIN.side;

export const COLOR = {
  text: '#1f2430',
  navy: '#0e1a3c',
  meta: '#4b5263',
  label: '#6b6f7d',
  rule: '#c0c4ce',
  tint: '#eef1f8',
  link: '#1a5fd0',
  letter: '#be3330',
} as const;

export const BODY = { size: px(8.3), lineHeight: 1.4 } as const;

export const FONT = {
  regular: 'Inter',
  bold: 'Inter-Bold',
  boldItalic: 'Inter-BoldItalic',
  extraBold: 'Inter-ExtraBold',
  wordmark: 'ClimateCrisis',
} as const;

const FONT_FILES: Record<string, string> = {
  [FONT.regular]: 'Inter-Regular.ttf',
  [FONT.bold]: 'Inter-Bold.ttf',
  [FONT.boldItalic]: 'Inter-BoldItalic.ttf',
  [FONT.extraBold]: 'Inter-ExtraBold.ttf',
  [FONT.wordmark]: 'ClimateCrisis-Variable.ttf',
};

/** Fonts are bundled in the repo (OFL, licences next to them); the app runs from the repo root. */
export function fontsDir(): string {
  return path.resolve(process.cwd(), 'assets', 'fonts');
}

export function registerFonts(doc: PDFKit.PDFDocument, dir: string = fontsDir()): void {
  for (const [name, file] of Object.entries(FONT_FILES)) doc.registerFont(name, path.join(dir, file));
}

export const STYLE_FONT: Record<TextStyle, string> = {
  regular: FONT.regular,
  bold: FONT.bold,
  boldItalic: FONT.boldItalic,
  value: FONT.bold,
  link: FONT.regular,
};

export const STYLE_COLOR: Record<TextStyle, string> = {
  regular: COLOR.text,
  bold: COLOR.text,
  boldItalic: COLOR.text,
  value: COLOR.navy,
  link: COLOR.link,
};
```

`src/club/documents/pdf/draw.ts`:

```ts
import type { Run, TextStyle } from '../runs';
import { layoutParagraph, type Measure, type PlacedRun } from './layout';
import { BODY, COLOR, S, STYLE_COLOR, STYLE_FONT, px } from './style';

type Doc = PDFKit.PDFDocument;

/** Inter's vertical metrics (units per em 2048: ascender 1984, descender -494). */
const ASCENT = 1984 / 2048;
const CONTENT = (1984 + 494) / 2048;

export type Box = { x: number; y: number; width: number };
export type ParagraphStyle = { size: number; lineHeight: number; align: 'justify' | 'left'; color?: string };

export const BODY_STYLE: ParagraphStyle = { size: BODY.size, lineHeight: BODY.lineHeight, align: 'justify' };

export function measureWith(doc: Doc, size: number): Measure {
  return (text: string, style: TextStyle) => doc.font(STYLE_FONT[style]).fontSize(size).widthOfString(text);
}

/** Top of the glyph box inside a CSS line box of `lineHeight` (half-leading above). */
export function glyphTop(lineTop: number, p: ParagraphStyle): number {
  return lineTop + (p.size * p.lineHeight - p.size * CONTENT) / 2;
}

export function baseline(lineTop: number, p: ParagraphStyle): number {
  return glyphTop(lineTop, p) + p.size * ASCENT;
}

export function hLine(doc: Doc, x1: number, x2: number, y: number, width = px(1), color: string = COLOR.text): void {
  doc.save().moveTo(x1, y).lineTo(x2, y).lineWidth(width).strokeColor(color).stroke().restore();
}

function drawText(doc: Doc, run: Extract<PlacedRun, { kind: 'text' }>, x: number, lineTop: number, p: ParagraphStyle): void {
  const pad = run.style === 'value' ? px(3) : 0;
  const trimmed = run.text.trimEnd();
  doc.font(STYLE_FONT[run.style]).fontSize(p.size);
  const inked = doc.widthOfString(trimmed) + (trimmed.split(' ').length - 1) * run.wordSpacing;
  if (run.style === 'value') doc.rect(x, glyphTop(lineTop, p), inked + 2 * pad, p.size * CONTENT).fill(COLOR.tint);
  doc.fillColor(run.style === 'regular' && p.color ? p.color : STYLE_COLOR[run.style]);
  doc.text(run.text, x + pad, glyphTop(lineTop, p), { lineBreak: false, wordSpacing: run.wordSpacing });
  if (run.style === 'link') hLine(doc, x, x + inked, baseline(lineTop, p) + px(1), px(0.6), COLOR.link);
}

function drawRun(doc: Doc, run: PlacedRun, left: number, lineTop: number, p: ParagraphStyle): void {
  const x = left + run.x;
  if (run.kind === 'text') drawText(doc, run, x, lineTop, p);
  else hLine(doc, x + px(2), x + run.width - px(2), baseline(lineTop, p) - px(0.5));
}

/** Draws a paragraph of runs and returns the y below its last line. */
export function drawParagraph(doc: Doc, runs: Run[], box: Box, p: ParagraphStyle = BODY_STYLE): number {
  const lines = layoutParagraph(runs, { width: box.width, measure: measureWith(doc, p.size), align: p.align, valuePad: px(3), scale: S });
  const lineHeight = p.size * p.lineHeight;
  lines.forEach((line, i) => line.forEach((run) => drawRun(doc, run, box.x, box.y + i * lineHeight, p)));
  return box.y + lines.length * lineHeight;
}

/** Height a paragraph would take, without drawing it. */
export function paragraphHeight(doc: Doc, runs: Run[], width: number, p: ParagraphStyle = BODY_STYLE): number {
  const lines = layoutParagraph(runs, { width, measure: measureWith(doc, p.size), align: p.align, valuePad: px(3), scale: S });
  return lines.length * p.size * p.lineHeight;
}

/** One line of single-style text at (x, lineTop); returns its width. */
export function drawLabel(doc: Doc, text: string, x: number, lineTop: number, o: { font: string; size: number; color: string; spacing?: number }): number {
  doc.font(o.font).fontSize(o.size).fillColor(o.color);
  doc.text(text, x, lineTop, { lineBreak: false, characterSpacing: o.spacing ?? 0 });
  return doc.widthOfString(text, { characterSpacing: o.spacing ?? 0 });
}

/** An empty tick box with its border, like the mockups' `.ck:before`. */
export function tickBox(doc: Doc, x: number, y: number, sizePx: number): void {
  doc.save().rect(x, y, px(sizePx), px(sizePx)).lineWidth(px(1.2)).strokeColor(COLOR.navy).stroke().restore();
}
```

`src/club/documents/pdf/blocks.ts`:

```ts
import { drawLabel, tickBox } from './draw';
import { BODY, COLOR, CONTENT_WIDTH, FONT, MARGIN, px } from './style';

type Doc = PDFKit.PDFDocument;

/** A text column in the current drawing space: left edge and width, pt. */
export type Col = { x: number; width: number };

/** CSS `line-height: normal` for Inter (ascender + descender). */
export const NORMAL_LINE = 1.21;
const TITLE_SIZE = px(13.5);

/** Small uppercase labels above signature lines (mockup .sig small). */
export const SIG_LABEL = { font: FONT.bold, size: px(8), color: COLOR.label, spacing: px(8 * 0.08) };
export const SIG_LABEL_LINE = px(8 * 1.4) + px(6);

/** Top of the glyphs of a one-line body label on a body line starting at `lineTop`. */
export const bodyGlyphTop = (lineTop: number) => lineTop + (BODY.size * BODY.lineHeight - BODY.size * NORMAL_LINE) / 2;

/** Thrown when the body would run into the footer (each document must stay one A4 page). */
export class DocumentOverflowError extends Error {
  constructor(kind: string) {
    super(`The ${kind} does not fit on one page`);
    this.name = 'DocumentOverflowError';
  }
}

/** Title in Inter bold 13.5px, navy, 14px below `y` (mockup .d2t); returns the y below `marginBottom`. */
export function drawTitle(doc: Doc, text: string, y: number, marginBottom: number): number {
  const top = y + px(14);
  drawLabel(doc, text, MARGIN.side, top, { font: FONT.bold, size: TITLE_SIZE, color: COLOR.navy, spacing: -TITLE_SIZE * 0.01 });
  return top + TITLE_SIZE * NORMAL_LINE + marginBottom;
}

/**
 * Draws the body below `top`, shrunk by `scale` (1 = the mockup's sizes) so a long text still fits one page.
 * The body draws in its own space: a column from x 0, as wide as the page column divided by `scale`.
 * Returns the page y below the body.
 */
export function drawScaledBody(doc: Doc, top: number, scale: number, body: (col: Col) => number): number {
  doc.save();
  doc.translate(MARGIN.side, top);
  doc.scale(scale);
  const height = body({ x: 0, width: CONTENT_WIDTH / scale });
  doc.restore();
  return top + height * scale;
}

export type TickRow = { box: number; inner: number; gap: number };

/** Empty tick boxes with bold labels ("□ Da  □ Nu") on one body line from `x`; returns the x after them. */
export function drawTicks(doc: Doc, labels: string[], x: number, lineTop: number, o: TickRow): number {
  const glyph = bodyGlyphTop(lineTop);
  let at = x;
  for (const label of labels) {
    tickBox(doc, at, glyph + (BODY.size * NORMAL_LINE - px(o.box)) / 2, o.box);
    at += px(o.box) + px(o.inner);
    at += drawLabel(doc, label, at, glyph, { font: FONT.bold, size: BODY.size, color: COLOR.text }) + px(o.gap);
  }
  return at;
}

/** A thin rectangle border (mockup: 1px solid #c0c4ce) around a box. */
export function frameBox(doc: Doc, x: number, y: number, width: number, height: number): void {
  doc.save().rect(x + px(0.5), y + px(0.5), width - px(1), height - px(1)).lineWidth(px(1)).strokeColor(COLOR.rule).stroke().restore();
}
```

`src/club/documents/pdf/frame.ts`:

```ts
import { ASSOCIATION_FOOTER, FOOTER_TITLES } from '../association';
import { t, v, type Run } from '../runs';
import type { DocumentValues } from '../types';
import type { Col } from './blocks';
import { drawLabel, drawParagraph, hLine, measureWith, paragraphHeight, type ParagraphStyle } from './draw';
import { layoutParagraph } from './layout';
import { COLOR, CONTENT_WIDTH, FONT, MARGIN, PAGE, S, px } from './style';

type Doc = PDFKit.PDFDocument;

const META: ParagraphStyle = { size: px(8.5), lineHeight: 1.6, align: 'left', color: COLOR.meta };
const PRE_LINE = px(7.5 * 1.4);
const WORDMARK = px(20);
const HEADER_BLOCK = PRE_LINE + px(3) + WORDMARK;

function lineWidth(doc: Doc, runs: Run[], p: ParagraphStyle): number {
  const line = layoutParagraph(runs, { width: 1e4, measure: measureWith(doc, p.size), align: 'left', valuePad: px(3), scale: S })[0];
  return line.reduce((w, r) => Math.max(w, r.x + r.width), 0);
}

function metaLine(doc: Doc, runs: Run[], lineTop: number): void {
  const width = lineWidth(doc, runs, META);
  drawParagraph(doc, runs, { x: PAGE.width - MARGIN.side - width, y: lineTop, width: width + 1 }, META);
}

/** CLUBUL SPORTIV / EDUSPORT on the left, Sezonul and Nr. înscriere on the right, navy rule below. Returns the y below. */
export function drawHeader(doc: Doc, values: DocumentValues): number {
  const top = MARGIN.top;
  drawLabel(doc, 'CLUBUL SPORTIV', MARGIN.side, top, { font: FONT.bold, size: px(7.5), color: COLOR.navy, spacing: px(7.5 * 0.34) });
  drawLabel(doc, 'EDUSPORT', MARGIN.side, top + PRE_LINE + px(3), { font: FONT.wordmark, size: WORDMARK, color: COLOR.navy, spacing: px(0.8) });
  const metaTop = top + HEADER_BLOCK - 2 * META.size * META.lineHeight;
  metaLine(doc, [t('Sezonul '), v(values.season, 60)], metaTop);
  metaLine(doc, [t('Nr. înscriere '), v(values.registrationNumber, 60)], metaTop + META.size * META.lineHeight);
  const rule = top + HEADER_BLOCK + px(10) + px(1);
  hLine(doc, MARGIN.side, PAGE.width - MARGIN.side, rule, px(2), COLOR.navy);
  return rule + px(1);
}

const COLUMN = { size: px(7.2), lineHeight: 1.5, align: 'left' } as const satisfies ParagraphStyle;
const TITLE_LINE = px(6.6 * 1.4) + px(3);
const LEGAL: ParagraphStyle = { size: px(7), lineHeight: 1.45, align: 'left', color: COLOR.label };
const GAP = px(14);
const FRACTIONS = [1, 1.05, 1, 1.35];

const contactLabelWidth = (doc: Doc) =>
  Math.max(...ASSOCIATION_FOOTER.contact.map(([label]) => doc.font(FONT.bold).fontSize(COLUMN.size).widthOfString(label)));

/** Like CSS grid `1fr 1.05fr 1fr 1.35fr`: Contact never narrower than its longest label + value; the rest share what is left. */
function columnXs(doc: Doc): Col[] {
  const total = FRACTIONS.reduce((a, f) => a + f, 0);
  const free = CONTENT_WIDTH - 3 * GAP;
  const longest = Math.max(...ASSOCIATION_FOOTER.contact.map(([, value]) => doc.font(FONT.regular).fontSize(COLUMN.size).widthOfString(value)));
  const contact = Math.max((FRACTIONS[3] * free) / total, contactLabelWidth(doc) + px(6) + longest);
  const unit = (free - contact) / (total - FRACTIONS[3]);
  const widths = [FRACTIONS[0] * unit, FRACTIONS[1] * unit, FRACTIONS[2] * unit, contact];
  let x = MARGIN.side;
  return widths.map((width) => {
    const col = { x, width };
    x += width + GAP;
    return col;
  });
}

/** Text lines of the first three columns; the fourth (Contact) is label / value rows. */
const TEXT_COLUMNS: string[][] = [[ASSOCIATION_FOOTER.seat], [...ASSOCIATION_FOOTER.registration], [...ASSOCIATION_FOOTER.account]];

function textColumn(doc: Doc, lines: string[], col: Col, top: number, draw: boolean): number {
  let y = top;
  for (const line of lines) {
    y = draw ? drawParagraph(doc, [t(line)], { ...col, y }, COLUMN) : y + paragraphHeight(doc, [t(line)], col.width, COLUMN);
  }
  return y - top;
}

function contactColumn(doc: Doc, col: Col, top: number, draw: boolean): number {
  const labelWidth = contactLabelWidth(doc);
  const valueBox = { x: col.x + labelWidth + px(6), width: col.width - labelWidth - px(6) };
  let y = top;
  for (const [label, value] of ASSOCIATION_FOOTER.contact) {
    if (draw) drawLabel(doc, label, col.x, y + (COLUMN.size * COLUMN.lineHeight - COLUMN.size * 1.21) / 2, { font: FONT.bold, size: COLUMN.size, color: COLOR.navy });
    y = (draw ? drawParagraph(doc, [t(value)], { ...valueBox, y }, COLUMN) : y + paragraphHeight(doc, [t(value)], valueBox.width, COLUMN)) + px(1);
  }
  return y - px(1) - top;
}

function columnsHeight(doc: Doc, top: number, draw: boolean): number {
  const cols = columnXs(doc);
  const heights = TEXT_COLUMNS.map((lines, i) => textColumn(doc, lines, cols[i], top, draw));
  return Math.max(...heights, contactColumn(doc, cols[3], top, draw));
}

function footerHeight(doc: Doc): number {
  const legal = paragraphHeight(doc, [t(ASSOCIATION_FOOTER.legal)], CONTENT_WIDTH, LEGAL);
  return px(10) + px(10) + px(1) + px(8) + TITLE_LINE + columnsHeight(doc, 0, false) + px(8) + legal;
}

/** Top edge of the footer: the body must end above it to keep the page to one A4 sheet. */
export function footerTop(doc: Doc): number {
  return PAGE.height - MARGIN.bottom - footerHeight(doc);
}

/** The 4-column association footer and the O.G. 26/2000 sentence, at the bottom of the page. */
export function drawFooter(doc: Doc): void {
  const rule = footerTop(doc) + px(20);
  hLine(doc, MARGIN.side, PAGE.width - MARGIN.side, rule + px(0.5), px(1), COLOR.rule);
  const titles = rule + px(1) + px(8);
  columnXs(doc).forEach((col, i) =>
    drawLabel(doc, FOOTER_TITLES[i].toUpperCase(), col.x, titles, { font: FONT.bold, size: px(6.6), color: COLOR.label, spacing: px(6.6 * 0.12) }),
  );
  const bottom = titles + TITLE_LINE + columnsHeight(doc, titles + TITLE_LINE, true);
  drawParagraph(doc, [t(ASSOCIATION_FOOTER.legal)], { x: MARGIN.side, y: bottom + px(8), width: CONTENT_WIDTH }, LEGAL);
}
```

`src/club/documents/pdf/acord.ts`:

```ts
import { ACORD_TITLE, acordContent, type AcordContent, type Clause } from '../acord-content';
import type { Run } from '../runs';
import type { DocumentValues } from '../types';
import {
  DocumentOverflowError,
  SIG_LABEL,
  SIG_LABEL_LINE,
  bodyGlyphTop,
  drawScaledBody,
  drawTicks,
  drawTitle,
  frameBox,
  type Col,
} from './blocks';
import { drawLabel, drawParagraph, hLine, paragraphHeight } from './draw';
import { drawFooter, drawHeader, footerTop } from './frame';
import { BODY, COLOR, FONT, px } from './style';

type Doc = PDFKit.PDFDocument;

function drawClause(doc: Doc, clause: Clause, col: Col, y: number): number {
  const top = y + px(2);
  drawLabel(doc, clause.letter, col.x, bodyGlyphTop(top), { font: FONT.extraBold, size: BODY.size, color: COLOR.letter });
  return drawParagraph(doc, clause.runs, { x: col.x + px(19), y: top, width: col.width - px(19) }) + px(2);
}

function drawClauses(doc: Doc, clauses: Clause[], col: Col, y: number): number {
  let bottom = y + px(6);
  for (const clause of clauses) bottom = drawClause(doc, clause, col, bottom);
  return bottom + px(8);
}

/** Marketing consent in a frame: real Da / Nu boxes, left empty for paper (mockup .cons). */
function drawMarketing(doc: Doc, runs: Run[], col: Col, y: number): number {
  const top = y + px(4);
  const inner = top + px(1) + px(6);
  const textX = drawTicks(doc, ['Da', 'Nu'], col.x + px(1) + px(8), inner, { box: 10, inner: 4, gap: 8 });
  const width = col.x + col.width - px(1) - px(8) - textX;
  drawParagraph(doc, runs, { x: textX, y: inner, width });
  const bottom = inner + paragraphHeight(doc, runs, width) + px(6) + px(1);
  frameBox(doc, col.x, top, col.width, bottom - top);
  return bottom + px(8);
}

/** Data (filled, or a blank line on the blank form) and Semnătura with its line (mockup .sig). */
function drawSignature(doc: Doc, date: string | null, col: Col, y: number): number {
  const top = y + px(10);
  const right = col.x + (col.width - px(30)) / 2.6 + px(30);
  const below = top + SIG_LABEL_LINE;
  drawLabel(doc, 'DATA', col.x, top, SIG_LABEL);
  drawLabel(doc, 'SEMNĂTURA', right, top, SIG_LABEL);
  if (date) drawLabel(doc, date, col.x, below + px(1), { font: FONT.bold, size: px(11), color: COLOR.navy });
  else hLine(doc, col.x, col.x + px(60), below + px(10));
  hLine(doc, right, col.x + col.width, below + px(22) - px(0.5));
  return below + px(22);
}

function acordBody(doc: Doc, content: AcordContent, date: string | null, col: Col): number {
  let y = drawParagraph(doc, content.intro, { ...col, y: 0 }) + px(5);
  y = drawParagraph(doc, content.consent, { ...col, y }) + px(5);
  y = drawClauses(doc, content.clauses, col, y);
  y = drawMarketing(doc, content.marketing, col, y);
  y = drawParagraph(doc, content.closing, { ...col, y }) + px(5);
  return drawSignature(doc, date, col, y);
}

/** The Acord (document-v4 layout, 4-column footer); `scale` shrinks the body when it would not fit one page. */
export function drawAcord(doc: Doc, values: DocumentValues, scale: number): void {
  const content = acordContent(values);
  const top = drawTitle(doc, ACORD_TITLE, drawHeader(doc, values), px(8));
  const bottom = drawScaledBody(doc, top, scale, (col) => acordBody(doc, content, values.date, col));
  if (bottom > footerTop(doc)) throw new DocumentOverflowError('acord');
  drawFooter(doc);
}
```

`src/club/documents/pdf/adeziune.ts`:

```ts
import { ADEZIUNE_SUBTITLE, ADEZIUNE_TITLE, OFFICE, adeziuneContent, type AdeziuneContent } from '../adeziune-content';
import type { Run } from '../runs';
import type { DocumentValues } from '../types';
import {
  DocumentOverflowError,
  SIG_LABEL,
  SIG_LABEL_LINE,
  bodyGlyphTop,
  drawScaledBody,
  drawTicks,
  drawTitle,
  frameBox,
  type Col,
} from './blocks';
import { drawLabel, drawParagraph, hLine } from './draw';
import { drawFooter, drawHeader, footerTop } from './frame';
import { BODY, COLOR, FONT, MARGIN, px } from './style';

type Doc = PDFKit.PDFDocument;

const BODY_LINE = BODY.size * BODY.lineHeight;
const TEXT = { font: FONT.regular, size: BODY.size, color: COLOR.text };

/** One declaration: empty Da / Nu boxes in a 62px column, the text beside it (mockup .dn). */
function drawDeclaration(doc: Doc, runs: Run[], col: Col, y: number): number {
  const top = y + px(3);
  drawTicks(doc, ['Da', 'Nu'], col.x, top, { box: 9, inner: 3, gap: 8 });
  return drawParagraph(doc, runs, { x: col.x + px(70), y: top, width: col.width - px(70) }) + px(3);
}

/** A small label with a line under it, `space` below the label; returns the y under the line. */
function signatureLine(doc: Doc, label: string, col: Col, y: number, space: number): number {
  drawLabel(doc, label, col.x, y, SIG_LABEL);
  const bottom = y + SIG_LABEL_LINE + space;
  hLine(doc, col.x, col.x + col.width, bottom - px(0.5));
  return bottom;
}

/** Nume (prefilled from the form, or empty), Semnătura and Data, each with its line (mockup .off .sig). */
function drawSignatures(doc: Doc, name: string | null, col: Col, y: number): number {
  if (name) drawLabel(doc, name, col.x, y + SIG_LABEL_LINE + px(1), { font: FONT.bold, size: px(11), color: COLOR.navy });
  let at = signatureLine(doc, 'NUME', col, y, name ? px(11 * 1.4) + px(4) : px(16));
  at = signatureLine(doc, 'SEMNĂTURA', col, at + px(8), px(22));
  return signatureLine(doc, 'DATA', col, at + px(8), px(16));
}

/** "Cererea a fost înregistrată cu nr ___ / ___" across the box's inner width. */
function drawRegisteredRow(doc: Doc, inner: Col, line: number): void {
  const label = drawLabel(doc, OFFICE.registered, inner.x, bodyGlyphTop(line), TEXT);
  const slash = doc.font(FONT.regular).fontSize(BODY.size).widthOfString('/');
  const blank = (inner.width - label - slash - 3 * px(6)) / 2;
  const start = inner.x + label + px(6);
  hLine(doc, start, start + blank, line + px(10));
  drawLabel(doc, '/', start + blank + px(6), bodyGlyphTop(line), TEXT);
  hLine(doc, inner.x + inner.width - blank, inner.x + inner.width, line + px(10));
}

/** The president's box contents, left empty: number, admis / respins, Președinte and a line (mockup .ob). */
function drawOffice(doc: Doc, box: Col, y: number): number {
  const inner = { x: box.x + px(11), width: box.width - px(22) };
  let line = y + px(1) + px(8);
  drawRegisteredRow(doc, inner, line);
  line += BODY_LINE + px(8);
  drawLabel(doc, OFFICE.member, inner.x, bodyGlyphTop(line), TEXT);
  drawTicks(doc, [OFFICE.admitted, OFFICE.rejected], inner.x + px(50), line, { box: 9, inner: 5, gap: 18 });
  line += BODY_LINE + px(8) + px(4);
  drawLabel(doc, OFFICE.president, inner.x, bodyGlyphTop(line), TEXT);
  line += BODY_LINE + px(8) + px(18);
  hLine(doc, inner.x, inner.x + inner.width, line - px(0.5));
  return line + px(8) + px(1);
}

function drawClosing(doc: Doc, name: string | null, col: Col, y: number): number {
  const top = y + px(12);
  const width = (col.width - px(26)) / 2;
  const box = { x: col.x + width + px(26), width };
  const bottom = Math.max(drawSignatures(doc, name, { x: col.x, width }, top), drawOffice(doc, box, top));
  frameBox(doc, box.x, top, box.width, bottom - top); // the box stretches to the signatures' height (CSS grid)
  return bottom;
}

function adeziuneBody(doc: Doc, content: AdeziuneContent, name: string | null, col: Col): number {
  let y = drawParagraph(doc, content.intro, { ...col, y: 0 }) + px(5);
  for (const declaration of content.declarations) y = drawDeclaration(doc, declaration, col, y);
  y = drawParagraph(doc, content.data, { ...col, y: y + px(6) }) + px(5);
  return drawClosing(doc, name, col, y);
}

/** The Cerere de adeziune (adeziune-v2 layout, 4-column footer); `scale` shrinks the body when needed. */
export function drawAdeziune(doc: Doc, values: DocumentValues, scale: number): void {
  const content = adeziuneContent(values);
  const subtitle = drawTitle(doc, ADEZIUNE_TITLE, drawHeader(doc, values), px(2));
  drawLabel(doc, ADEZIUNE_SUBTITLE, MARGIN.side, bodyGlyphTop(subtitle), { font: FONT.bold, size: BODY.size, color: COLOR.navy });
  const top = subtitle + BODY_LINE + px(8);
  const bottom = drawScaledBody(doc, top, scale, (col) => adeziuneBody(doc, content, values.parentName, col));
  if (bottom > footerTop(doc)) throw new DocumentOverflowError('adeziune');
  drawFooter(doc);
}
```

`src/club/documents/pdf/render.ts`:

```ts
import PDFDocument from 'pdfkit';
import type { DocumentKind, DocumentValues } from '../types';
import { drawAcord } from './acord';
import { drawAdeziune } from './adeziune';
import { DocumentOverflowError } from './blocks';
import { PAGE, registerFonts } from './style';

const TITLES: Record<DocumentKind, string> = { acord: 'Acord', adeziune: 'Cerere de adeziune' };

const DRAW: Record<DocumentKind, (doc: PDFKit.PDFDocument, values: DocumentValues, scale: number) => void> = {
  acord: drawAcord,
  adeziune: drawAdeziune,
};

/** Body sizes tried in turn, largest first: 1 is the mockup's size; the first that fits one page wins. */
export const BODY_SCALES = [1, 0.96, 0.92, 0.88, 0.85, 0.82, 0.8] as const;

function renderOnce(kind: DocumentKind, values: DocumentValues, scale: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: 0, info: { Title: TITLES[kind], Author: 'Asociația Clubul Sportiv EduSport' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      registerFonts(doc);
      DRAW[kind](doc, values, scale);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/** Renders one document as a one-page A4 PDF. Null values print blank lines (blank forms, missing answers). */
export async function renderDocument(kind: DocumentKind, values: DocumentValues): Promise<Buffer> {
  for (const scale of BODY_SCALES) {
    try {
      return await renderOnce(kind, values, scale);
    } catch (err) {
      if (!(err instanceof DocumentOverflowError)) throw err;
    }
  }
  throw new DocumentOverflowError(kind);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/club/documents/__tests__/render.test.ts`
Expected: PASS (9 tests, about 10 s; the file raises its test timeout to 30 s because the whole suite runs files in parallel). Then `npm test` (all PASS) and `npx tsc --noEmit` (zero errors).

- [ ] **Step 5: Commit**

```bash
git add src/club/documents/pdf src/club/documents/__tests__/pdf-text.ts src/club/documents/__tests__/render.test.ts
git commit -m "feat(documents): draw the Acord and the Cerere de adeziune with pdfkit, one A4 page each"
```

---

### Task 8: Service, routes, submit and edit wiring

**Files:**
- Create: `src/club/documents/requests.ts`, `src/club/documents/service.ts`, `src/club/documents/submit-response.ts`, `src/club/documents/bulk-delete.ts`, `src/club/documents/season-move.ts`, `src/club/documents/index.ts`
- Create: `src/api/club/controllers/documents.ts`, `src/api/club/routes/03-documents.ts`
- Modify: `src/club/registration-submit.ts` (plan 2A: `SubmitResult`, `SubmitDeps.createNumbered`, `save`)
- Modify: `src/club/__tests__/registration-submit.test.ts` (plan 2A: the fake `createNumbered` and the first expectation)
- Modify: `src/api/registration-submission/controllers/registration-submission.ts` (imports, a `removeDocuments` helper, `submitPublic`, the end of `updateSubmission`, `deleteSubmission`, `deleteArchivedSeason`, `moveSeason`, `moveWholeSeason`)
- Test: `src/club/documents/__tests__/requests.test.ts`, `submit-response.test.ts`, `routes.test.ts`, `public-download.test.ts`, `delete-documents.test.ts`, `bulk-delete.test.ts`, `season-move.test.ts`, `season-move-pdf.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 6, 7; plan 2A (`submitRegistration`, `SubmitResult`, `SUBMIT_ERRORS`, `findCurrentSeason`, `asText`, service `createNumbered` returning `{ documentId, registrationNumber }`).
- Produces (cross-plan contract, exported from `src/club/documents/index.ts`):
  - `type DocumentKind = 'acord' | 'adeziune'`, `interface StoredDocument { kind: DocumentKind; fileName: string; path: string }`
  - `buildRegistrationDocuments(strapi: Core.Strapi, registrationDocumentId: string): Promise<StoredDocument[]>` (builds or rebuilds and stores; new files before old ones are deleted; never sends an e-mail; throws `RegistrationNotFoundError` for an unknown id)
  - `listRegistrationDocuments(strapi: Core.Strapi, registrationDocumentId: string): Promise<StoredDocument[]>`
  - `createDownloadToken(registrationDocumentId: string, now?: Date): string`, `verifyDownloadToken(token: unknown, now?: Date): { registrationDocumentId: string } | null`
  - `deleteRegistrationDocuments(strapi: Core.Strapi, registrationDocumentId: string): Promise<void>` (deletes the registration's folder; missing files or an unsafe id: nothing happens)
  - `deleteRegistrationsWithDocuments(deps: BulkDeleteDeps): Promise<number>` with `BulkDeleteDeps = { findIds(); deleteRows(); deleteDocuments(id); logError(message) }`: reads the ids, deletes the rows, then each folder; a failing folder is logged and the rest continue; returns the deleted row count.
  - `type RebuildResult = { ok: boolean; documents: DocumentKind[]; reason?: 'unknown-season' | 'failed' }`
  - `rebuildDocuments(strapi, registrationDocumentId): Promise<RebuildResult>` (never throws; a failure is logged, `reason: 'failed'`)
  - `rebuildAfterEdit(strapi, registrationDocumentId, data): Promise<RebuildResult | null>` (null when no printed field is in `data`; `reason: 'unknown-season'` without rebuilding when `data.season` is set but `data.seasonRef` is null)
  - `touchesDocuments(data): boolean`, `DOCUMENT_FIELDS` (re-exported from `requests.ts`; plan 2B imports them from `index.ts` only)
  - `seasonIdForLabel(strapi, label): Promise<string | null>` (the Sezon of that label, or null)
  - `moveRegistrationsToSeason(ids, label, deps: SeasonMoveDeps): Promise<number>` and `seasonMoveDeps(strapi)`: for each registration, set `season` and `seasonRef` together, then rebuild its PDFs; a failure is logged and the loop goes on; with no Sezon of that label `seasonRef` is null and the rebuild is skipped with a logged reason. The registration number never changes (D2).
  - also `renderBlankDocument(strapi, kind)`, `finishSubmit`, `submitBlockedReason`, `type PublicSubmitResponse`, `documentTokenSecret`, `DOWNLOAD_TOKEN_TTL_MS`, `isDocumentKind`, `DOCUMENT_KINDS`.
  - HTTP:
    - `POST /api/forms/inscriere?scoala=` success: 200 `{ ok: true, registrationNumber, downloadToken, documents: DocumentKind[] }` (`documents` is `[]` when the build failed; the registration is saved anyway). Errors unchanged from 2A: 400 `{ ok: false, code, error }`. New: 503 `{ ok: false, code: 'save-failed', error: 'Nu am putut salva înscrierea.' }` in production without `DOCUMENT_TOKEN_SECRET` (nothing saved).
    - `GET /api/forms/inscriere/documents?token=&kind=acord|adeziune` (public): 200 PDF (`Content-Disposition: attachment; filename="<file>"`, `Cache-Control: private, no-store`); an expired or bad token: 302 redirect to `<first FRONTEND_ORIGIN>/inscrieri/link-expirat` (`http://localhost:3000/...` outside production; 410 `{ error: 'expired' }` only in production without `FRONTEND_ORIGIN`); 400 `{ error: 'invalid' }` unknown kind; 404 `{ error: 'not-found' }` no such document.
    - `GET /api/club/registrations/:documentId/documents/:kind` (admin): 200 PDF; builds the set first when it is missing (old registrations, a failed build at submit: this is the admin's rebuild); 400, 404 as above.
    - `GET /api/club/documents/blank/:kind` (admin): 200 PDF `Formular-gol_Acord_2026-2027.pdf` / `Formular-gol_Adeziune_2026-2027.pdf`, current Sezon printed (blank lines when no Sezon is current); not stored.
    - `DELETE /api/forms/inscrieri/:documentId` (admin, existing): also deletes the registration's PDFs (D7); a failure there is logged and the delete still answers 200 as before.
    - `POST /api/forms/inscrieri/delete-archived-season` (admin, existing): also deletes the PDFs of every registration it deletes (ids read before the rows are deleted); response unchanged `{ ok: true, deleted }`.
    - `PUT /api/forms/inscrieri/:documentId` (admin, existing): a `season` in the body also sets `seasonRef` to the Sezon of that label (null when none). When the saved fields include one printed on the PDFs (`DOCUMENT_FIELDS`: email, phone, parentName, relationship, relationshipOther, childName, childBirthDate, membershipAnswer, season), the response gains `rebuild: RebuildResult` (the PDFs are rebuilt, or `reason: 'unknown-season'` when the new season has no Sezon and the old PDFs stay); otherwise the response is unchanged `{ data }`. No e-mail.
    - `POST /api/forms/inscrieri/move-season` and `POST /api/forms/inscrieri/move-whole-season` (admin, existing): also set `seasonRef` and rebuild each moved registration's PDFs (cross-plan review I1); responses unchanged `{ moved }` (now the number of registrations actually moved, one by one). The registration number never changes.

Change to plan 2A's interface: `SubmitResult`'s success gains the internal `documentId` (needed to build the PDFs and sign the link), and `SubmitDeps.createNumbered` returns `{ documentId, registrationNumber }` (2A's real service already returns both). The controller never sends `documentId` to the browser (DECISIONS 2026-10-03); `finishSubmit` builds the public body field by field and its test pins that.

- [ ] **Step 1: Write the failing tests**

`src/club/documents/__tests__/requests.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expiredLinkUrl, pdfHeaders, readAdminRequest, readPublicRequest, touchesDocuments } from '../requests';
import { createDownloadToken } from '../token';

const ID = 'reg0000000000000000000001';
const NOW = new Date('2026-10-20T10:00:00.000Z');
afterEach(() => vi.unstubAllEnvs());

describe('document requests', () => {
  it('public: a valid token and a known kind', () => {
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', 'a-test-secret-that-is-at-least-32-characters-long');
    const token = createDownloadToken(ID, NOW);
    expect(readPublicRequest({ token, kind: 'adeziune' }, NOW)).toEqual({ ok: true, registrationDocumentId: ID, kind: 'adeziune' });
    expect(readPublicRequest({ token, kind: 'contract' }, NOW)).toEqual({ ok: false, status: 400 });
    expect(readPublicRequest({ token: 'x.y', kind: 'acord' }, NOW)).toEqual({ ok: false, status: 410 });
    expect(readPublicRequest({ kind: 'acord' }, NOW)).toEqual({ ok: false, status: 410 });
  });

  it('admin: a safe id and a known kind', () => {
    expect(readAdminRequest({ documentId: ID, kind: 'acord' })).toEqual({ ok: true, registrationDocumentId: ID, kind: 'acord' });
    expect(readAdminRequest({ documentId: '../etc', kind: 'acord' })).toEqual({ ok: false, status: 400 });
    expect(readAdminRequest({ documentId: ID, kind: 'x' })).toEqual({ ok: false, status: 400 });
  });

  it('downloads are attachments, never cached or indexed', () => {
    expect(pdfHeaders('Maria_Pop_Acord_2026-2027.pdf')).toEqual({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Maria_Pop_Acord_2026-2027.pdf"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    });
    expect(pdfHeaders('a"b\r\n.pdf')['Content-Disposition']).toBe('attachment; filename="a_b__.pdf"');
  });

  it('sends an expired or invalid link to the site page /inscrieri/link-expirat', () => {
    expect(expiredLinkUrl({ FRONTEND_ORIGIN: 'https://scoaladepatinaj.com, https://www.scoaladepatinaj.com' })).toBe(
      'https://scoaladepatinaj.com/inscrieri/link-expirat',
    );
    expect(expiredLinkUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000/inscrieri/link-expirat');
    expect(expiredLinkUrl({ NODE_ENV: 'production' })).toBeNull();
  });

  it('only edits of printed fields rebuild the PDFs', () => {
    expect(touchesDocuments({ childName: 'Ana' })).toBe(true);
    expect(touchesDocuments({ membershipAnswer: 'nu' })).toBe(true);
    expect(touchesDocuments({ status: 'Contactat', internalNote: 'x', archived: true })).toBe(false);
  });
});
```

`src/club/documents/__tests__/submit-response.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SUBMIT_ERRORS } from '../../registration-submit';
import { finishSubmit, submitBlockedReason, type FinishDeps } from '../submit-response';
import type { StoredDocument } from '../types';

const OK = { ok: true as const, registrationNumber: '2026-0008', documentId: 'reg0000000000000000000001' };
const STORED: StoredDocument[] = [
  { kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', path: '/x/a.pdf' },
  { kind: 'adeziune', fileName: 'Ana_Pop_Adeziune_2026-2027.pdf', path: '/x/b.pdf' },
];

function deps(over: Partial<FinishDeps> = {}) {
  const errors: string[] = [];
  const built: string[] = [];
  const d: FinishDeps = {
    buildDocuments: async (id) => {
      built.push(id);
      return STORED;
    },
    createToken: (id) => `token-for-${id}`,
    logError: (m) => {
      errors.push(m);
    },
    ...over,
  };
  return { d, errors, built };
}

describe('finishSubmit', () => {
  it('returns the number, the download token and the built kinds, never the internal id', async () => {
    const { d, built } = deps();
    const response = await finishSubmit(OK, d);
    expect(response).toEqual({ ok: true, registrationNumber: '2026-0008', downloadToken: 'token-for-reg0000000000000000000001', documents: ['acord', 'adeziune'] });
    expect(JSON.stringify(response)).not.toContain('"documentId"');
    expect(built).toEqual(['reg0000000000000000000001']);
  });

  it('keeps the registration when the PDFs fail, logs it, lists no documents', async () => {
    const { d, errors } = deps({
      buildDocuments: async () => {
        throw new Error('disk full');
      },
    });
    await expect(finishSubmit(OK, d)).resolves.toMatchObject({ ok: true, registrationNumber: '2026-0008', documents: [] });
    expect(errors[0]).toContain('2026-0008');
    expect(errors[0]).toContain('disk full');
  });

  it('passes a refused submit through without building anything', async () => {
    const { d, built } = deps();
    const refused = { ok: false as const, code: 'closed' as const, error: SUBMIT_ERRORS.closed };
    await expect(finishSubmit(refused, d)).resolves.toEqual(refused);
    expect(built).toEqual([]);
  });
});

describe('submitBlockedReason', () => {
  it('refuses submits in production without DOCUMENT_TOKEN_SECRET', () => {
    expect(submitBlockedReason({ NODE_ENV: 'production' })).toEqual({ ok: false, code: 'save-failed', error: SUBMIT_ERRORS['save-failed'] });
    expect(submitBlockedReason({ NODE_ENV: 'production', DOCUMENT_TOKEN_SECRET: 'x'.repeat(32) })).toBeNull();
    expect(submitBlockedReason({ NODE_ENV: 'development' })).toBeNull();
  });
});
```

`src/club/documents/__tests__/routes.test.ts`:

```ts
import { expect, it } from 'vitest';
import routes from '../../../api/club/routes/03-documents';

it('serves the PDFs at the contract paths: public by token, the rest admin-only', () => {
  expect(routes.routes).toEqual([
    { method: 'GET', path: '/forms/inscriere/documents', handler: 'documents.publicDownload', config: { auth: false, policies: [], middlewares: [] } },
    {
      method: 'GET',
      path: '/club/registrations/:documentId/documents/:kind',
      handler: 'documents.registrationDocument',
      config: { auth: false, policies: ['global::is-admin'], middlewares: [] },
    },
    { method: 'GET', path: '/club/documents/blank/:kind', handler: 'documents.blankForm', config: { auth: false, policies: ['global::is-admin'], middlewares: [] } },
  ]);
});
```

`src/club/documents/__tests__/public-download.test.ts`:

```ts
import { afterEach, expect, it, vi } from 'vitest';
import controller from '../../../api/club/controllers/documents';

afterEach(() => vi.unstubAllEnvs());

function fakeCtx(query: Record<string, unknown>) {
  const ctx = {
    query,
    params: {},
    status: 200,
    body: undefined as unknown,
    redirected: null as string | null,
    set: () => undefined,
    redirect(url: string) {
      ctx.redirected = url;
      ctx.status = 302;
    },
  };
  return ctx;
}

it('redirects an expired or forged link to the site page, never streams anything', async () => {
  vi.stubEnv('FRONTEND_ORIGIN', 'https://scoaladepatinaj.com');
  for (const token of ['x.y', '', undefined]) {
    const ctx = fakeCtx({ token, kind: 'acord' });
    await controller.publicDownload(ctx);
    expect(ctx.status).toBe(302);
    expect(ctx.redirected).toBe('https://scoaladepatinaj.com/inscrieri/link-expirat');
    expect(ctx.body).toBeUndefined();
  }
});

it('answers 400 for an unknown kind, and 410 when no site address is configured in production', async () => {
  const unknown = fakeCtx({ token: 'x.y', kind: 'contract' });
  await controller.publicDownload(unknown);
  expect(unknown).toMatchObject({ status: 400, body: { error: 'invalid' }, redirected: null });
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('FRONTEND_ORIGIN', '');
  vi.stubEnv('DOCUMENT_TOKEN_SECRET', 'a-test-secret-that-is-at-least-32-characters-long');
  const bare = fakeCtx({ token: 'x.y', kind: 'acord' });
  await controller.publicDownload(bare);
  expect(bare).toMatchObject({ status: 410, body: { error: 'expired' }, redirected: null });
});
```

`src/club/documents/__tests__/delete-documents.test.ts`:

```ts
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Core } from '@strapi/strapi';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deleteRegistrationDocuments, listRegistrationDocuments } from '../service';
import { registrationDir, replaceStored } from '../storage';

const ID = 'reg0000000000000000000001';
let app: string;
beforeEach(async () => {
  app = await fs.mkdtemp(path.join(os.tmpdir(), 'edusport-app-'));
  vi.stubEnv('PRIVATE_FILES_DIR', '');
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(app, { recursive: true, force: true });
});

/** Only `dirs.app.root` is read by the storage side of the service. */
const fakeStrapi = () => ({ dirs: { app: { root: app } } }) as unknown as Core.Strapi;

it('deleting a registration deletes its stored PDFs, and is idempotent', async () => {
  const dir = registrationDir(path.join(app, 'private', 'documents'), ID);
  await replaceStored(dir, [
    { kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: Buffer.from('%PDF a') },
    { kind: 'adeziune', fileName: 'Ana_Pop_Adeziune_2026-2027.pdf', data: Buffer.from('%PDF b') },
  ]);
  expect(await listRegistrationDocuments(fakeStrapi(), ID)).toHaveLength(2);
  await deleteRegistrationDocuments(fakeStrapi(), ID);
  await expect(fs.access(dir)).rejects.toThrow();
  await expect(deleteRegistrationDocuments(fakeStrapi(), ID)).resolves.toBeUndefined();
  await expect(deleteRegistrationDocuments(fakeStrapi(), '../../etc')).resolves.toBeUndefined();
});
```

`src/club/documents/__tests__/bulk-delete.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deleteRegistrationsWithDocuments, type BulkDeleteDeps } from '../bulk-delete';

function fake(over: Partial<BulkDeleteDeps> = {}) {
  const calls: string[] = [];
  const errors: string[] = [];
  const deps: BulkDeleteDeps = {
    findIds: async () => {
      calls.push('find');
      return ['reg0000000000000000000001', 'reg0000000000000000000002', 'reg0000000000000000000003'];
    },
    deleteRows: async () => {
      calls.push('delete rows');
      return 3;
    },
    deleteDocuments: async (id) => {
      calls.push(`delete documents ${id}`);
    },
    logError: (m) => {
      errors.push(m);
    },
    ...over,
  };
  return { deps, calls, errors };
}

describe('deleteRegistrationsWithDocuments (delete archived season)', () => {
  it('reads the ids first, deletes the rows, then every registration folder', async () => {
    const { deps, calls } = fake();
    await expect(deleteRegistrationsWithDocuments(deps)).resolves.toBe(3);
    expect(calls).toEqual([
      'find',
      'delete rows',
      'delete documents reg0000000000000000000001',
      'delete documents reg0000000000000000000002',
      'delete documents reg0000000000000000000003',
    ]);
  });

  it('logs a folder that fails and still removes the others', async () => {
    const removed: string[] = [];
    const { deps, errors } = fake({
      deleteDocuments: async (id) => {
        if (id.endsWith('2')) throw new Error('EACCES');
        removed.push(id);
      },
    });
    await expect(deleteRegistrationsWithDocuments(deps)).resolves.toBe(3);
    expect(removed).toEqual(['reg0000000000000000000001', 'reg0000000000000000000003']);
    expect(errors).toEqual(['[inscrieri] deleting documents of reg0000000000000000000002 failed: EACCES']);
  });

  it('removes no folder when deleting the rows fails', async () => {
    const { deps, calls } = fake({
      deleteRows: async () => {
        throw new Error('database down');
      },
    });
    await expect(deleteRegistrationsWithDocuments(deps)).rejects.toThrow('database down');
    expect(calls).toEqual(['find']);
  });
});
```

`src/club/documents/__tests__/season-move.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { moveRegistrationsToSeason, type SeasonMoveDeps } from '../season-move';

const A = 'reg0000000000000000000001';
const B = 'reg0000000000000000000002';
const C = 'reg0000000000000000000003';

function fake(over: Partial<SeasonMoveDeps> = {}) {
  const calls: string[] = [];
  const errors: string[] = [];
  const deps: SeasonMoveDeps = {
    seasonIdFor: async (label) => (label === '2027-2028' ? 'season2027' : null),
    setSeason: async (id, label, seasonRef) => {
      calls.push(`set ${id} ${label} ${seasonRef}`);
      return id !== C;
    },
    rebuild: async (id) => {
      calls.push(`rebuild ${id}`);
      return { ok: true, documents: ['acord'] };
    },
    logError: (m) => {
      errors.push(m);
    },
    ...over,
  };
  return { deps, calls, errors };
}

describe('moveRegistrationsToSeason', () => {
  it('sets the season text and its Sezon together, then rebuilds each moved registration', async () => {
    const { deps, calls, errors } = fake();
    await expect(moveRegistrationsToSeason([A, B], '2027-2028', deps)).resolves.toBe(2);
    expect(calls).toEqual([`set ${A} 2027-2028 season2027`, `rebuild ${A}`, `set ${B} 2027-2028 season2027`, `rebuild ${B}`]);
    expect(errors).toEqual([]);
  });

  it('an unknown season label sets seasonRef to null and skips the rebuild with a logged reason', async () => {
    const { deps, calls, errors } = fake();
    await expect(moveRegistrationsToSeason([A], '2030-2031', deps)).resolves.toBe(1);
    expect(calls).toEqual([`set ${A} 2030-2031 null`]);
    expect(errors).toEqual(['[inscrieri] no Sezon is labelled "2030-2031": documents of 1 moved registration(s) not rebuilt']);
  });

  it('never aborts: a failing registration is logged, a missing one is not counted, the others move', async () => {
    const { deps, calls, errors } = fake({
      setSeason: async (id, label, seasonRef) => {
        calls.push(`set ${id} ${label} ${seasonRef}`);
        if (id === A) throw new Error('database down');
        return id !== C;
      },
    });
    await expect(moveRegistrationsToSeason([A, C, B], '2027-2028', deps)).resolves.toBe(1);
    expect(calls).toEqual([`set ${A} 2027-2028 season2027`, `set ${C} 2027-2028 season2027`, `set ${B} 2027-2028 season2027`, `rebuild ${B}`]);
    expect(errors).toEqual([`[inscrieri] moving ${A} to 2027-2028 failed: database down`]);
  });
});
```

`src/club/documents/__tests__/season-move-pdf.test.ts`:

```ts
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Core } from '@strapi/strapi';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveRegistrationsToSeason, seasonMoveDeps } from '../season-move';
import { buildRegistrationDocuments, listRegistrationDocuments, rebuildAfterEdit } from '../service';
import { pdfText } from './pdf-text';

vi.setConfig({ testTimeout: 30_000 });

const ID = 'reg0000000000000000000001';
const SEASONS = [
  { documentId: 'season2026', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270 },
  { documentId: 'season2027', label: '2027-2028', startMonth: '2027-10-01', endMonth: '2028-05-31', membershipFee: 300 },
];

let app: string;
let row: Record<string, unknown>;
let logs: string[];

/** A Strapi stand-in: one registration, the two Sezoane, the app folder and a log. */
function fakeStrapi(): Core.Strapi {
  const registration = {
    findOne: async () => row,
    update: async ({ data }: { data: { season: string; seasonRef: string | null } }) => {
      row = { ...row, season: data.season, seasonRef: SEASONS.find((s) => s.documentId === data.seasonRef) ?? null };
      return row;
    },
  };
  const seasons = { findFirst: async ({ filters }: { filters: { label: string } }) => SEASONS.find((s) => s.label === filters.label) ?? null };
  const log = (m: string) => logs.push(m);
  return {
    dirs: { app: { root: app } },
    documents: (uid: string) => (uid === 'api::season.season' ? seasons : registration),
    log: { error: log, warn: log },
  } as unknown as Core.Strapi;
}

beforeEach(async () => {
  app = await fs.mkdtemp(path.join(os.tmpdir(), 'edusport-move-'));
  vi.stubEnv('PRIVATE_FILES_DIR', '');
  logs = [];
  row = {
    documentId: ID,
    registrationNumber: '2026-0142',
    parentName: 'Ana Pop',
    phone: '0712345678',
    email: 'ana.pop@example.com',
    relationship: 'parinte',
    childName: 'Maria Pop',
    childBirthDate: '2016-03-14',
    membershipAnswer: 'nu',
    submittedAt: '2026-10-03T08:00:00.000Z',
    season: '2026-2027',
    seasonRef: SEASONS[0],
  };
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(app, { recursive: true, force: true });
});

const fileNames = async (strapi: Core.Strapi) => (await listRegistrationDocuments(strapi, ID)).map((d) => d.fileName);

describe('moving a registration to another season', () => {
  it('rebuilds the PDF with the new season, period and file name; the number stays', async () => {
    const strapi = fakeStrapi();
    await buildRegistrationDocuments(strapi, ID);
    expect(await fileNames(strapi)).toEqual(['Maria_Pop_Acord_2026-2027.pdf']);
    await expect(moveRegistrationsToSeason([ID], '2027-2028', seasonMoveDeps(strapi))).resolves.toBe(1);
    const [doc] = await listRegistrationDocuments(strapi, ID);
    expect(doc.fileName).toBe('Maria_Pop_Acord_2027-2028.pdf');
    const { text } = await pdfText(await fs.readFile(doc.path));
    expect(text).toContain('Sezonul 2027-2028');
    expect(text).toContain('Nr. înscriere 2026-0142');
    expect(text).toContain('(octombrie 2027 – mai 2028)');
    expect(row.registrationNumber).toBe('2026-0142');
  });

  it('an unknown season label clears seasonRef and keeps the old PDF, with a logged reason', async () => {
    const strapi = fakeStrapi();
    await buildRegistrationDocuments(strapi, ID);
    await moveRegistrationsToSeason([ID], '2030-2031', seasonMoveDeps(strapi));
    expect(row).toMatchObject({ season: '2030-2031', seasonRef: null });
    expect(await fileNames(strapi)).toEqual(['Maria_Pop_Acord_2026-2027.pdf']);
    expect(logs).toEqual(['[inscrieri] no Sezon is labelled "2030-2031": documents of 1 moved registration(s) not rebuilt']);
  });
});

describe('rebuildAfterEdit (admin PUT)', () => {
  it('does nothing when no printed field changed', async () => {
    await expect(rebuildAfterEdit(fakeStrapi(), ID, { status: 'Contactat' })).resolves.toBeNull();
  });

  it('skips the rebuild with a logged reason when the new season has no Sezon', async () => {
    const strapi = fakeStrapi();
    await expect(rebuildAfterEdit(strapi, ID, { season: '2030-2031', seasonRef: null })).resolves.toEqual({
      ok: false,
      documents: [],
      reason: 'unknown-season',
    });
    expect(logs).toEqual([`[inscrieri] ${ID}: no Sezon is labelled "2030-2031"; documents not rebuilt`]);
    expect(await fileNames(strapi)).toEqual([]);
  });

  it('rebuilds after a season change to a known Sezon', async () => {
    const strapi = fakeStrapi();
    row = { ...row, season: '2027-2028', seasonRef: SEASONS[1] };
    await expect(rebuildAfterEdit(strapi, ID, { season: '2027-2028', seasonRef: 'season2027' })).resolves.toEqual({ ok: true, documents: ['acord'] });
    expect(await fileNames(strapi)).toEqual(['Maria_Pop_Acord_2027-2028.pdf']);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- src/club/documents/__tests__/requests.test.ts src/club/documents/__tests__/submit-response.test.ts src/club/documents/__tests__/routes.test.ts src/club/documents/__tests__/public-download.test.ts src/club/documents/__tests__/delete-documents.test.ts src/club/documents/__tests__/bulk-delete.test.ts src/club/documents/__tests__/season-move.test.ts src/club/documents/__tests__/season-move-pdf.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Carry the internal id through plan 2A's submit result**

In `src/club/registration-submit.ts` replace

```ts
export type SubmitResult = { ok: true; registrationNumber: string } | { ok: false; code: SubmitErrorCode; error: string };
```

with

```ts
/** `documentId` is internal: the controller never returns it (DECISIONS 2026-10-03); it is used to build the PDFs. */
export type SubmitResult =
  | { ok: true; registrationNumber: string; documentId: string }
  | { ok: false; code: SubmitErrorCode; error: string };
```

replace

```ts
  createNumbered(data: RegistrationCreateData, startYear: number): Promise<{ registrationNumber: string }>;
```

with

```ts
  createNumbered(data: RegistrationCreateData, startYear: number): Promise<{ documentId: string; registrationNumber: string }>;
```

and in `save` replace

```ts
    const { registrationNumber } = await deps.createNumbered(data, startYear);
    return { ok: true, registrationNumber };
```

with

```ts
    const { registrationNumber, documentId } = await deps.createNumbered(data, startYear);
    return { ok: true, registrationNumber, documentId };
```

In `src/club/__tests__/registration-submit.test.ts` replace

```ts
      return { registrationNumber: '2026-0008' };
```

with

```ts
      return { documentId: 'reg0000000000000000000001', registrationNumber: '2026-0008' };
```

and replace

```ts
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: true, registrationNumber: '2026-0008' });
```

with

```ts
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({
      ok: true,
      registrationNumber: '2026-0008',
      documentId: 'reg0000000000000000000001',
    });
```

Run: `npm test -- src/club/__tests__/registration-submit.test.ts` (PASS, 13 tests) and `npx tsc --noEmit` (zero errors: `submit-deps.ts` already passes the service's `NumberedRegistration`).

- [ ] **Step 4: Implement the documents service, requests and controller**

`src/club/documents/requests.ts`:

```ts
import { isSafeDocumentId } from './storage';
import { verifyDownloadToken } from './token';
import { isDocumentKind, type DocumentKind, type StoredDocument } from './types';

export type DocumentRequest = { ok: true; registrationDocumentId: string; kind: DocumentKind } | { ok: false; status: 400 | 410 };

/** GET /api/forms/inscriere/documents?token=&kind=: a known kind (400 otherwise) and a valid, unexpired token (410 otherwise). */
export function readPublicRequest(query: Record<string, unknown>, now: Date = new Date()): DocumentRequest {
  if (!isDocumentKind(query.kind)) return { ok: false, status: 400 };
  const token = verifyDownloadToken(query.token, now);
  return token ? { ok: true, registrationDocumentId: token.registrationDocumentId, kind: query.kind } : { ok: false, status: 410 };
}

/** GET /api/club/registrations/:documentId/documents/:kind (admin). */
export function readAdminRequest(params: Record<string, unknown>): DocumentRequest {
  if (!isDocumentKind(params.kind) || !isSafeDocumentId(params.documentId)) return { ok: false, status: 400 };
  return { ok: true, registrationDocumentId: params.documentId, kind: params.kind };
}

/**
 * Where an expired or invalid public link sends the browser: the site's page `/inscrieri/link-expirat`
 * (plan 2C). The site is the first origin of FRONTEND_ORIGIN (the CORS list, also used by
 * src/utils/revalidate.ts); locally http://localhost:3000. Null in production without FRONTEND_ORIGIN.
 */
export function expiredLinkUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const site = (env.FRONTEND_ORIGIN ?? '').split(',').map((s) => s.trim()).find(Boolean);
  const base = site ?? (env.NODE_ENV === 'production' ? null : 'http://localhost:3000');
  return base ? new URL('/inscrieri/link-expirat', base).toString() : null;
}

export const findKind = (docs: StoredDocument[], kind: DocumentKind) => docs.find((d) => d.kind === kind) ?? null;

/** Response headers for a PDF download: never cached, never indexed, saved under its own name. */
export function pdfHeaders(fileName: string): Record<string, string> {
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
  };
}

/** Registration fields printed on the documents: saving any of them rebuilds the PDFs. */
export const DOCUMENT_FIELDS = [
  'email',
  'phone',
  'parentName',
  'relationship',
  'relationshipOther',
  'childName',
  'childBirthDate',
  'membershipAnswer',
  'season',
] as const;

export function touchesDocuments(data: Record<string, unknown>): boolean {
  return DOCUMENT_FIELDS.some((key) => key in data);
}
```

`src/club/documents/service.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { asText } from '../narrow';
import { findCurrentSeason } from '../current-season';
import { blankFileName, documentFileName } from './format';
import { touchesDocuments } from './requests';
import { renderDocument } from './pdf/render';
import { documentsRoot, isSafeDocumentId, listStored, registrationDir, removeStored, replaceStored, type NewFile } from './storage';
import type { DocumentKind, DocumentSeason, StoredDocument } from './types';
import { blankValues, documentKindsFor, registrationValues, type RegistrationRow } from './values';

const UID = 'api::registration-submission.registration-submission' as const;

export class RegistrationNotFoundError extends Error {
  constructor(documentId: string) {
    super(`Registration ${documentId} not found`);
    this.name = 'RegistrationNotFoundError';
  }
}

const root = (strapi: Core.Strapi) => documentsRoot(strapi.dirs.app.root);

/** A Sezon row as the documents need it, or null when it is missing or malformed. */
export function toDocumentSeason(raw: unknown): DocumentSeason | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const fee = typeof s.membershipFee === 'number' && Number.isFinite(s.membershipFee) ? s.membershipFee : null;
  const label = asText(s.label);
  return label ? { label, startMonth: asText(s.startMonth), endMonth: asText(s.endMonth), membershipFee: fee } : null;
}

/** The registration's Sezon; registrations from before phase 2 have only the season label. */
async function seasonOf(strapi: Core.Strapi, seasonRef: unknown, label: unknown): Promise<DocumentSeason | null> {
  const linked = toDocumentSeason(seasonRef);
  if (linked || !asText(label)) return linked;
  return toDocumentSeason(await strapi.documents('api::season.season').findFirst({ filters: { label: asText(label) } }));
}

async function loadRegistration(strapi: Core.Strapi, documentId: string) {
  const doc = await strapi.documents(UID).findOne({ documentId, populate: { seasonRef: true } });
  if (!doc) throw new RegistrationNotFoundError(documentId);
  const row = doc as unknown as RegistrationRow & { seasonRef?: unknown };
  return { row, season: await seasonOf(strapi, row.seasonRef, row.season) };
}

/**
 * Builds (or rebuilds) a registration's PDFs and stores them: the Acord, plus the Cerere de adeziune when
 * the membership answer is Da. New files are written before old ones are deleted. Never sends an e-mail.
 */
export async function buildRegistrationDocuments(strapi: Core.Strapi, registrationDocumentId: string): Promise<StoredDocument[]> {
  const dir = registrationDir(root(strapi), registrationDocumentId);
  const { row, season } = await loadRegistration(strapi, registrationDocumentId);
  const values = registrationValues(row, season);
  const fallback = asText(row.registrationNumber);
  const files: NewFile[] = [];
  for (const kind of documentKindsFor(row)) {
    files.push({ kind, fileName: documentFileName(kind, values.childName, values.season, fallback), data: await renderDocument(kind, values) });
  }
  return replaceStored(dir, files);
}

/** Outcome of a rebuild, as the admin PUT returns it (`reason` only when nothing was rebuilt). */
export type RebuildResult = { ok: boolean; documents: DocumentKind[]; reason?: 'unknown-season' | 'failed' };

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Rebuilds a registration's PDFs; never throws: a failure is logged and reported. Never sends an e-mail. */
export async function rebuildDocuments(strapi: Core.Strapi, registrationDocumentId: string): Promise<RebuildResult> {
  try {
    return { ok: true, documents: (await buildRegistrationDocuments(strapi, registrationDocumentId)).map((d) => d.kind) };
  } catch (err) {
    strapi.log.error(`[inscrieri] rebuilding documents of ${registrationDocumentId} failed: ${message(err)}`);
    return { ok: false, documents: [], reason: 'failed' };
  }
}

/** The documentId of the Sezon labelled `label`, or null (no label, or no such Sezon). */
export async function seasonIdForLabel(strapi: Core.Strapi, label: unknown): Promise<string | null> {
  const text = asText(label);
  if (!text) return null;
  const season = await strapi.documents('api::season.season').findFirst({ filters: { label: text } });
  return season?.documentId ?? null;
}

/**
 * After an admin edit saved `data`: rebuild when a printed field changed. A season changed to a label with
 * no Sezon (`seasonRef` null) skips the rebuild, logged, and the old PDFs stay.
 */
export async function rebuildAfterEdit(strapi: Core.Strapi, registrationDocumentId: string, data: Record<string, unknown>): Promise<RebuildResult | null> {
  if (!touchesDocuments(data)) return null;
  if ('season' in data && !data.seasonRef) {
    strapi.log.warn(`[inscrieri] ${registrationDocumentId}: no Sezon is labelled "${asText(data.season)}"; documents not rebuilt`);
    return { ok: false, documents: [], reason: 'unknown-season' };
  }
  return rebuildDocuments(strapi, registrationDocumentId);
}

/** The PDFs stored for a registration (empty when none were built). */
export async function listRegistrationDocuments(strapi: Core.Strapi, registrationDocumentId: string): Promise<StoredDocument[]> {
  return listStored(registrationDir(root(strapi), registrationDocumentId));
}

/** Deletes a registration's stored PDFs (the registration was deleted). Missing files or folder: nothing happens. */
export async function deleteRegistrationDocuments(strapi: Core.Strapi, registrationDocumentId: string): Promise<void> {
  if (!isSafeDocumentId(registrationDocumentId)) return;
  await removeStored(registrationDir(root(strapi), registrationDocumentId));
}

/** A blank form for paper sign-ups: the current Sezon's season, period and fee, everything else blank. Not stored. */
export async function renderBlankDocument(strapi: Core.Strapi, kind: DocumentKind): Promise<{ fileName: string; data: Buffer }> {
  const season = toDocumentSeason(await findCurrentSeason(strapi));
  return { fileName: blankFileName(kind, season?.label ?? null), data: await renderDocument(kind, blankValues(season)) };
}
```

`src/club/documents/submit-response.ts`:

```ts
import { SUBMIT_ERRORS, type SubmitResult } from '../registration-submit';
import { documentTokenSecret } from './token';
import type { DocumentKind, StoredDocument } from './types';

/** POST /api/forms/inscriere success body (cross-plan contract): no internal id, a 24 h download token. */
export type PublicSubmitSuccess = { ok: true; registrationNumber: string; downloadToken: string; documents: DocumentKind[] };
export type PublicSubmitFailure = Extract<SubmitResult, { ok: false }>;
export type PublicSubmitResponse = PublicSubmitSuccess | PublicSubmitFailure;

export interface FinishDeps {
  buildDocuments(registrationDocumentId: string): Promise<StoredDocument[]>;
  createToken(registrationDocumentId: string): string;
  logError(message: string): void;
}

/**
 * Fails closed: in production, without DOCUMENT_TOKEN_SECRET no registration is taken (the success screen
 * could not offer its download). Returns the refusal, or null when submits may proceed.
 */
export function submitBlockedReason(env: NodeJS.ProcessEnv = process.env): PublicSubmitFailure | null {
  if (documentTokenSecret(env)) return null;
  return { ok: false, code: 'save-failed', error: SUBMIT_ERRORS['save-failed'] };
}

/** After a saved registration: build its PDFs (a failure is logged; the registration still succeeds) and sign the link. */
export async function finishSubmit(result: SubmitResult, deps: FinishDeps): Promise<PublicSubmitResponse> {
  if (result.ok === false) return result;
  let documents: DocumentKind[] = [];
  try {
    documents = (await deps.buildDocuments(result.documentId)).map((d) => d.kind);
  } catch (err) {
    deps.logError(`[inscriere] documents for ${result.registrationNumber} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { ok: true, registrationNumber: result.registrationNumber, downloadToken: deps.createToken(result.documentId), documents };
}
```

`src/club/documents/bulk-delete.ts`:

```ts
export interface BulkDeleteDeps {
  /** Ids of the registrations about to be deleted, read before the delete. */
  findIds(): Promise<string[]>;
  /** Deletes the rows; returns how many were deleted. */
  deleteRows(): Promise<number>;
  deleteDocuments(registrationDocumentId: string): Promise<void>;
  logError(message: string): void;
}

/**
 * Deletes registrations and then their PDFs (user, 2026-10-21: deleting a registration also deletes its PDFs).
 * Ids are read first, rows deleted next, folders last; a folder that fails is logged and the rest continue.
 */
export async function deleteRegistrationsWithDocuments(deps: BulkDeleteDeps): Promise<number> {
  const ids = await deps.findIds();
  const count = await deps.deleteRows();
  for (const id of ids) {
    try {
      await deps.deleteDocuments(id);
    } catch (err) {
      deps.logError(`[inscrieri] deleting documents of ${id} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return count;
}
```

`src/club/documents/season-move.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { rebuildDocuments, seasonIdForLabel, type RebuildResult } from './service';

const UID = 'api::registration-submission.registration-submission' as const;

export interface SeasonMoveDeps {
  seasonIdFor(label: string): Promise<string | null>;
  /** Sets the season text and its Sezon link; false when the registration does not exist. Never the number. */
  setSeason(registrationDocumentId: string, label: string, seasonRef: string | null): Promise<boolean>;
  rebuild(registrationDocumentId: string): Promise<RebuildResult>;
  logError(message: string): void;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function moveOne(id: string, label: string, seasonRef: string | null, deps: SeasonMoveDeps): Promise<boolean> {
  try {
    if (!(await deps.setSeason(id, label, seasonRef))) return false;
  } catch (err) {
    deps.logError(`[inscrieri] moving ${id} to ${label} failed: ${message(err)}`);
    return false;
  }
  if (seasonRef) await deps.rebuild(id); // logs its own failure, never throws
  return true;
}

/**
 * Moves registrations to the season `label`: the season text and `seasonRef` change together, then each
 * registration's PDFs are rebuilt (new files first). One failure is logged and the loop goes on. With no
 * Sezon of that label, `seasonRef` becomes null and the rebuild is skipped with a logged reason.
 * The registration number never changes (D2). Returns how many registrations were moved.
 */
export async function moveRegistrationsToSeason(ids: string[], label: string, deps: SeasonMoveDeps): Promise<number> {
  const seasonRef = await deps.seasonIdFor(label);
  let moved = 0;
  for (const id of ids) if (await moveOne(id, label, seasonRef, deps)) moved += 1;
  if (!seasonRef && moved > 0) deps.logError(`[inscrieri] no Sezon is labelled "${label}": documents of ${moved} moved registration(s) not rebuilt`);
  return moved;
}

/** The Strapi side of moveRegistrationsToSeason. */
export function seasonMoveDeps(strapi: Core.Strapi): SeasonMoveDeps {
  return {
    seasonIdFor: (label) => seasonIdForLabel(strapi, label),
    setSeason: async (documentId, label, seasonRef) =>
      Boolean(await strapi.documents(UID).update({ documentId, data: { season: label, seasonRef } })),
    rebuild: (documentId) => rebuildDocuments(strapi, documentId),
    logError: (msg) => strapi.log.error(msg),
  };
}
```

`src/club/documents/index.ts`:

```ts
/** Registration PDFs (plan 2D). Other plans import from here only. */
export { DOCUMENT_KINDS, isDocumentKind, type DocumentKind, type StoredDocument } from './types';
export {
  buildRegistrationDocuments,
  deleteRegistrationDocuments,
  listRegistrationDocuments,
  rebuildAfterEdit,
  rebuildDocuments,
  seasonIdForLabel,
  type RebuildResult,
  renderBlankDocument,
  RegistrationNotFoundError,
} from './service';
export { deleteRegistrationsWithDocuments, type BulkDeleteDeps } from './bulk-delete';
export { DOCUMENT_FIELDS, touchesDocuments } from './requests';
export { moveRegistrationsToSeason, seasonMoveDeps, type SeasonMoveDeps } from './season-move';
export { createDownloadToken, verifyDownloadToken, documentTokenSecret, DOWNLOAD_TOKEN_TTL_MS } from './token';
export { finishSubmit, submitBlockedReason, type PublicSubmitResponse, type PublicSubmitSuccess } from './submit-response';
```

`src/api/club/controllers/documents.ts`:

```ts
import { createReadStream } from 'node:fs';
import {
  buildRegistrationDocuments,
  listRegistrationDocuments,
  renderBlankDocument,
  RegistrationNotFoundError,
  isDocumentKind,
  type DocumentKind,
  type StoredDocument,
} from '../../../club/documents';
import { expiredLinkUrl, findKind, pdfHeaders, readAdminRequest, readPublicRequest } from '../../../club/documents/requests';

type Ctx = {
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  status: number;
  body: unknown;
  set(headers: Record<string, string>): void;
  redirect(url: string): void;
};

function sendFile(ctx: Ctx, doc: StoredDocument): void {
  ctx.set(pdfHeaders(doc.fileName));
  ctx.body = createReadStream(doc.path);
}

/** An expired or invalid link goes to the site's "link expirat" page (user, 2026-10-21); an unknown kind is a 400. */
function refusePublic(ctx: Ctx, status: 400 | 410): void {
  const target = status === 410 ? expiredLinkUrl() : null;
  if (target) {
    ctx.redirect(target);
    return;
  }
  ctx.status = status;
  ctx.body = { error: status === 410 ? 'expired' : 'invalid' };
}

function notFound(ctx: Ctx): void {
  ctx.status = 404;
  ctx.body = { error: 'not-found' };
}

/** The stored PDF of `kind`; for the admin, a missing set is built first (old registrations, a failed build at submit). */
async function storedOrBuilt(registrationDocumentId: string, kind: DocumentKind): Promise<StoredDocument | null> {
  const stored = findKind(await listRegistrationDocuments(strapi, registrationDocumentId), kind);
  if (stored) return stored;
  try {
    return findKind(await buildRegistrationDocuments(strapi, registrationDocumentId), kind);
  } catch (err) {
    if (err instanceof RegistrationNotFoundError) return null;
    throw err;
  }
}

export default {
  /** GET /api/forms/inscriere/documents?token=&kind= (public): the success screen's 24-hour download. */
  async publicDownload(ctx: Ctx) {
    const request = readPublicRequest(ctx.query);
    if (request.ok === false) {
      refusePublic(ctx, request.status);
      return;
    }
    const doc = findKind(await listRegistrationDocuments(strapi, request.registrationDocumentId), request.kind);
    if (doc) sendFile(ctx, doc);
    else notFound(ctx);
  },

  /** GET /api/club/registrations/:documentId/documents/:kind (admin). */
  async registrationDocument(ctx: Ctx) {
    const request = readAdminRequest(ctx.params);
    if (request.ok === false) {
      ctx.status = 400;
      ctx.body = { error: 'invalid' };
      return;
    }
    const doc = await storedOrBuilt(request.registrationDocumentId, request.kind);
    if (doc) sendFile(ctx, doc);
    else notFound(ctx);
  },

  /** GET /api/club/documents/blank/:kind (admin): "Formulare goale", printed with the current Sezon. */
  async blankForm(ctx: Ctx) {
    if (!isDocumentKind(ctx.params.kind)) {
      ctx.status = 400;
      ctx.body = { error: 'invalid' };
      return;
    }
    const { fileName, data } = await renderBlankDocument(strapi, ctx.params.kind);
    ctx.set(pdfHeaders(fileName));
    ctx.body = data;
  },
};
```

`src/api/club/routes/03-documents.ts`:

```ts
/**
 * Registration PDFs (plan 2D). The public route is guarded by the signed 24-hour token in the query,
 * the others by the admin JWT (`global::is-admin`), like the other club admin routes.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    {
      method: 'GET',
      path: '/forms/inscriere/documents',
      handler: 'documents.publicDownload',
      config: { auth: false, policies: [], middlewares: [] },
    },
    { method: 'GET', path: '/club/registrations/:documentId/documents/:kind', handler: 'documents.registrationDocument', config: adminGuard },
    { method: 'GET', path: '/club/documents/blank/:kind', handler: 'documents.blankForm', config: adminGuard },
  ],
};
```

Strapi resolves `handler: 'documents.publicDownload'` in `src/api/club/routes/` to the controller file `src/api/club/controllers/documents.ts` (checked in the Task 9 boot run). The controller uses the global `strapi`, like `club.ts`.

- [ ] **Step 5: Wire the submit and the admin edit**

In `src/api/registration-submission/controllers/registration-submission.ts`:

1. Under `import { buildSubmitDeps } from '../submit-deps';` add:

```ts
import {
  buildRegistrationDocuments,
  createDownloadToken,
  deleteRegistrationDocuments,
  deleteRegistrationsWithDocuments,
  finishSubmit,
  moveRegistrationsToSeason,
  rebuildAfterEdit,
  seasonIdForLabel,
  seasonMoveDeps,
  submitBlockedReason,
} from '../../../club/documents';
```

2. Directly above `export default factories.createCoreController(UID, ({ strapi }) => ({` add the helper:

```ts
/** A deleted registration takes its PDFs with it; a failure is logged, the delete still succeeds. */
async function removeDocuments(documentId: string): Promise<void> {
  try {
    await deleteRegistrationDocuments(strapi, documentId);
  } catch (err) {
    strapi.log.error(`[inscrieri] deleting documents of ${documentId} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

```

3. Replace the end of 2A's `submitPublic` doc comment and body, from

```ts
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

with

```ts
   * Then builds the PDFs (plan 2D; a failed build is logged, the registration still succeeds).
   * Returns 200 {ok:true, registrationNumber, downloadToken, documents} or 400 {ok:false, code, error};
   * 503 when DOCUMENT_TOKEN_SECRET is missing in production (fails closed, nothing saved).
   */
  async submitPublic(ctx) {
    const blocked = submitBlockedReason();
    if (blocked) {
      strapi.log.error('[inscriere] DOCUMENT_TOKEN_SECRET is missing: registrations are refused');
      ctx.status = 503;
      ctx.body = blocked;
      return;
    }
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const slug = typeof ctx.query.scoala === 'string' ? ctx.query.scoala : null;
    const saved = await submitRegistration(body, slug, buildSubmitDeps(strapi));
    const result = await finishSubmit(saved, {
      buildDocuments: (documentId) => buildRegistrationDocuments(strapi, documentId),
      createToken: (documentId) => createDownloadToken(documentId),
      logError: (message) => strapi.log.error(message),
    });
    ctx.status = result.ok ? 200 : 400;
    ctx.body = result;
  },
```

(`saved` stays a separate variable so plan 2F can call `enqueueRegistrationEmail(strapi, saved.documentId)` after `finishSubmit` when `saved.ok`.)

4. In `updateSubmission` replace

```ts
    const doc = await strapi.documents(UID).update({ documentId, data });
    if (!doc) return ctx.notFound();
    ctx.body = { data: doc };
```

with

```ts
    // A new season text also points seasonRef at the Sezon of that label (null when none matches).
    if ('season' in data) data.seasonRef = await seasonIdForLabel(strapi, data.season);

    const doc = await strapi.documents(UID).update({ documentId, data });
    if (!doc) return ctx.notFound();
    const rebuild = await rebuildAfterEdit(strapi, documentId, data);
    ctx.body = rebuild ? { data: doc, rebuild } : { data: doc };
```

(`data` holds only `EDITABLE_FIELDS`. Today that list has the printed fields `email`, `phone`, `childName`, `childBirthDate`, `parentName`, `season`; plan 2B adds `relationship`, `relationshipOther` and the other new fields to it, and their edits then rebuild too. `seasonRef` is set by the server only, never from the body.)

5. In `deleteSubmission`, under its doc comment line `* DELETE /api/forms/inscrieri/:documentId  (admin-guarded) ...` add the line

```ts
   * Its stored PDFs are deleted too (user, 2026-10-21).
```

and replace

```ts
    await strapi.documents(UID).delete({ documentId });
    ctx.body = { data: { documentId } };
```

with

```ts
    await strapi.documents(UID).delete({ documentId });
    await removeDocuments(documentId);
    ctx.body = { data: { documentId } };
```

6. In `deleteArchivedSeason`, after the line `* Permanently delete every archived submission in a season. Body: { season }.` add

```ts
   * Their stored PDFs are deleted too (user, 2026-10-21): ids first, then the rows, then the folders.
```

and replace

```ts
    const { count } = await strapi.db.query(UID).deleteMany({
      where: { season, archived: true },
    });
    ctx.body = { ok: true, deleted: count };
```

with

```ts
    const where = { season, archived: true };
    const count = await deleteRegistrationsWithDocuments({
      findIds: async () => {
        const rows = (await strapi.db.query(UID).findMany({ select: ['documentId'], where })) as { documentId?: unknown }[];
        return rows.map((r) => r.documentId).filter((id): id is string => typeof id === 'string');
      },
      deleteRows: async () => (await strapi.db.query(UID).deleteMany({ where })).count,
      deleteDocuments: (documentId) => deleteRegistrationDocuments(strapi, documentId),
      logError: (message) => strapi.log.error(message),
    });
    ctx.body = { ok: true, deleted: count };
```

7. In `moveSeason`, after the doc comment line `* Unknown ids are ignored. Returns { moved: number }.` add

```ts
   * Also points seasonRef at the Sezon of that label and rebuilds each moved registration's PDFs
   * (plan 2D); the registration number never changes.
```

and replace

```ts
    const { count } = await strapi.db.query(UID).updateMany({
      where: { documentId: { $in: ids } },
      data: { season: toSeason },
    });
    ctx.body = { moved: count };
```

with

```ts
    ctx.body = { moved: await moveRegistrationsToSeason(ids, toSeason, seasonMoveDeps(strapi)) };
```

8. In `moveWholeSeason`, after the doc comment line ``* to `toSeason`. Body: { fromSeason, toSeason, archivedOnly? }.`` add

```ts
   * Also points seasonRef at the Sezon of that label and rebuilds each moved registration's PDFs
   * (plan 2D; a failure is logged and the loop goes on); the registration number never changes.
```

and replace

```ts
    const { count } = await strapi.db.query(UID).updateMany({ where, data: { season: toSeason } });
    ctx.body = { moved: count };
```

with

```ts
    const rows = (await strapi.db.query(UID).findMany({ select: ['documentId'], where })) as { documentId?: unknown }[];
    const ids = rows.map((r) => r.documentId).filter((id): id is string => typeof id === 'string');
    ctx.body = { moved: await moveRegistrationsToSeason(ids, toSeason, seasonMoveDeps(strapi)) };
```

Why one by one: `seasonRef` is a relation (a link table), which `db.query().updateMany` does not write; the document service `update` does, and each moved registration then needs its own rebuild anyway.

- [ ] **Step 6: Run everything**

Run: `npm test -- src/club/documents/__tests__/requests.test.ts src/club/documents/__tests__/submit-response.test.ts src/club/documents/__tests__/routes.test.ts src/club/documents/__tests__/public-download.test.ts src/club/documents/__tests__/delete-documents.test.ts src/club/documents/__tests__/bulk-delete.test.ts src/club/documents/__tests__/season-move.test.ts src/club/documents/__tests__/season-move-pdf.test.ts` (PASS, 24 tests), then `npm test` (all PASS) and `npx tsc --noEmit` (zero errors).

- [ ] **Step 7: Commit**

```bash
git add src/club/documents/requests.ts src/club/documents/service.ts src/club/documents/submit-response.ts src/club/documents/bulk-delete.ts src/club/documents/season-move.ts src/club/documents/index.ts \
  src/api/club/controllers/documents.ts src/api/club/routes/03-documents.ts \
  src/club/registration-submit.ts src/club/__tests__/registration-submit.test.ts \
  src/api/registration-submission/controllers/registration-submission.ts \
  src/club/documents/__tests__/requests.test.ts src/club/documents/__tests__/submit-response.test.ts src/club/documents/__tests__/routes.test.ts \
  src/club/documents/__tests__/public-download.test.ts src/club/documents/__tests__/delete-documents.test.ts src/club/documents/__tests__/bulk-delete.test.ts \
  src/club/documents/__tests__/season-move.test.ts src/club/documents/__tests__/season-move-pdf.test.ts
git commit -m "feat(documents): build PDFs at submit, rebuild on edit and season moves, delete with the registration, token and admin downloads, blank forms"
```

---

### Task 9: Boot check on a throwaway Postgres

**Files:** none committed. A scratch folder `.es2d/` in the repo root, deleted at the end (dot folders are ignored by the dev watcher).

**Interfaces:**
- Consumes: everything above.
- Produces: evidence that the routes, the private folder, the token, the expired-link redirect, the rebuild on edit, the delete and the fail-closed submit work in a real Strapi on Postgres with `NODE_ENV=production`.

Pick free ports first (`lsof -nP -iTCP:<port> -sTCP:LISTEN` prints nothing): this plan uses Postgres on 55444 and Strapi on 1344. Never 1337, never the containers `strapi_db` or `strapi_app`.

- [ ] **Step 1: Start Postgres, build, load a fixture, start Strapi, exercise the routes**

Save as `.es2d/check.sh` and run `bash .es2d/check.sh` from the repo root:

```bash
set -u
T="$PWD/.es2d"; mkdir -p "$T"
cat > "$T/env" <<EOF
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55444
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
HOST=127.0.0.1
PORT=1344
APP_KEYS=throwawayA,throwawayB
API_TOKEN_SALT=throwaway
ADMIN_JWT_SECRET=throwaway
TRANSFER_TOKEN_SALT=throwaway
JWT_SECRET=throwaway
ENCRYPTION_KEY=throwaway
STRAPI_TELEMETRY_DISABLED=true
NODE_ENV=production
DOCUMENT_TOKEN_SECRET=throwaway-document-token-secret-0123456789abcdef
PRIVATE_FILES_DIR=$T/private
FRONTEND_ORIGIN=https://scoaladepatinaj.com
EOF
docker run -d --name es2d-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi -p 127.0.0.1:55444:5432 postgres:16 >/dev/null
until docker exec es2d-pg pg_isready -U strapi >/dev/null 2>&1; do perl -e "select(undef,undef,undef,1)"; done
(set -a; . "$T/env"; set +a; npm run build >/dev/null 2>&1; echo build=$?)
cat > "$T/fixture.js" <<'EOF'
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  await d('api::site-settings.site-settings').create({ data: { registration: { open: true } } });
  await d('api::season.season').create({ data: { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270, isCurrent: true } });
  const school = await d('api::section.section').create({ data: { name: 'Școala de Patinaj', kind: 'school', slug: 'scoala', registrationsOpen: true, publicPage: true } });
  await d('api::price-list.price-list').create({ data: { name: 'Standard', section: school.documentId, items: [
    { name: 'Abonament 8 ședințe grup', kind: 'subscription', sessions: 8, memberPrice: 590, nonMemberPrice: 790 },
  ] } });
  console.log('fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
EOF
(set -a; . "$T/env"; set +a; node "$T/fixture.js")
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1344/_health | grep -q 204; do perl -e "select(undef,undef,undef,2)"; done
cat > "$T/body.json" <<'EOF'
{"email":"ana.pop@example.com","parentName":"Ana Pop","relationship":"parinte","phone":"0712345678",
 "childName":"Maria Ștefănescu","childBirthDate":"2016-03-14","childHeight":"132","shirtSize":"S",
 "lastSeason":"Nu a participat","priorExperience":"Nu este cazul","expectations":"Să învețe să patineze",
 "membershipAnswer":"da","subscriptionChoice":{"priceItemName":"Abonament 8 ședințe grup"},
 "source":"Facebook","gdprConsent":true,"regulationsConsent":true}
EOF
curl -s -X POST http://127.0.0.1:1344/api/forms/inscriere -H 'Content-Type: application/json' --data-binary @"$T/body.json" > "$T/submit.json"; cat "$T/submit.json"; echo
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$T/submit.json','utf8')).downloadToken)")
find "$T/private" -type f | sed "s|$T/||"
curl -s -D "$T/h1" -o "$T/dl.pdf" "http://127.0.0.1:1344/api/forms/inscriere/documents?token=$TOKEN&kind=adeziune"; grep -iE "^HTTP|content-type|content-disposition|cache-control" "$T/h1"
curl -s -o /dev/null -w 'bad token %{http_code} %{redirect_url}\n' "http://127.0.0.1:1344/api/forms/inscriere/documents?token=x.y&kind=acord"
curl -s -o /dev/null -w 'admin no auth %{http_code}\n' "http://127.0.0.1:1344/api/club/documents/blank/acord"
JWT=$(node -e "console.log(require('jsonwebtoken').sign({userId:1},'throwaway'))")
curl -s -D "$T/h2" -o "$T/blank.pdf" -H "Authorization: Bearer $JWT" "http://127.0.0.1:1344/api/club/documents/blank/acord"; grep -iE "^HTTP|content-disposition" "$T/h2"
DOC=$(docker exec es2d-pg psql -U strapi -d strapi -tAc "select document_id from registration_submissions limit 1")
curl -s -o /dev/null -w 'admin doc %{http_code}\n' -H "Authorization: Bearer $JWT" "http://127.0.0.1:1344/api/club/registrations/$DOC/documents/acord"
curl -s -X PUT -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' "http://127.0.0.1:1344/api/forms/inscrieri/$DOC" --data '{"childName":"Maria Popescu"}' \
  | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>console.log('PUT rebuild',JSON.stringify(JSON.parse(s).rebuild)))"
find "$T/private" -type f | sed "s|$T/||"
curl -s -o /dev/null -w 'delete %{http_code}\n' -X DELETE -H "Authorization: Bearer $JWT" "http://127.0.0.1:1344/api/forms/inscrieri/$DOC"
ls "$T/private/registrations"
kill "$(cat "$T/pid")"
```

Expected (the document id and token differ):

```
fixture ok
{"ok":true,"registrationNumber":"2026-0001","downloadToken":"<token>","documents":["acord","adeziune"]}
private/registrations/<id>/Maria_Stefanescu_Acord_2026-2027.pdf
private/registrations/<id>/Maria_Stefanescu_Adeziune_2026-2027.pdf
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="Maria_Stefanescu_Adeziune_2026-2027.pdf"
Cache-Control: private, no-store
bad token 302 https://scoaladepatinaj.com/inscrieri/link-expirat
admin no auth 403
HTTP/1.1 200 OK
Content-Disposition: attachment; filename="Formular-gol_Acord_2026-2027.pdf"
admin doc 200
PUT rebuild {"ok":true,"documents":["acord","adeziune"]}
private/registrations/<id>/Maria_Popescu_Acord_2026-2027.pdf
private/registrations/<id>/Maria_Popescu_Adeziune_2026-2027.pdf
delete 200
```

(`ls` prints nothing: the registration's folder is gone.)

- [ ] **Step 2: The fee comes from Postgres, and production without the secret refuses submits**

```bash
T="$PWD/.es2d"
cat > "$T/text.mjs" <<'EOF'
import { readFileSync } from 'node:fs';
import { extractText, getDocumentProxy } from 'unpdf';
const { text } = await extractText(await getDocumentProxy(new Uint8Array(readFileSync(process.argv[2]))), { mergePages: true });
console.log(text.replace(/\s+/g, ' ').match(/perioadei.{0,40}/)[0]);
EOF
node "$T/text.mjs" "$T/dl.pdf"
grep -v DOCUMENT_TOKEN_SECRET "$T/env" > "$T/env2"
(set -a; . "$T/env2"; set +a; ./node_modules/.bin/strapi start > "$T/strapi2.log" 2>&1 & echo $! > "$T/pid2")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1344/_health | grep -q 204; do perl -e "select(undef,undef,undef,2)"; done
curl -s -w ' %{http_code}\n' -X POST http://127.0.0.1:1344/api/forms/inscriere -H 'Content-Type: application/json' --data-binary @"$T/body.json"
docker exec es2d-pg psql -U strapi -d strapi -tAc 'select count(*) from registration_submissions'
grep -c "DOCUMENT_TOKEN_SECRET is missing" "$T/strapi2.log"
kill "$(cat "$T/pid2")"
```

Expected:

```
perioadei octombrie 2026-mai 2027 este de 270 ron
{"ok":false,"code":"save-failed","error":"Nu am putut salva înscrierea."} 503
0
1
```

(0 rows: the only registration was deleted in Step 1 and the refused submit saved nothing.)

- [ ] **Step 3: Clean up and re-run the suite**

```bash
docker rm -f es2d-pg
rm -rf .es2d
npm test
npx tsc --noEmit
```

Expected: container removed; all tests PASS; zero type errors. No commit in this task; a fix goes into the owning task's files with a `fix(documents): ...` commit.

---

### Task 10: Visual check for the companion

**Files:**
- Create: `src/club/documents/__tests__/preview.test.ts` (skipped unless `DOCUMENT_PREVIEW_DIR` is set)
- Output, not committed: `../edusport_frontend/docs/portal/mockups/screens/pdf-check-v1/` with `acord.png`, `acord-gol.png`, `adeziune.png`, `adeziune-gol.png` (the PDFs as images), the four PDFs, and `acord-mockup.png`, `adeziune-mockup.png` (the approved mockups rendered by Chrome)

**Interfaces:**
- Consumes: `renderDocument`, `registrationValues`, `blankValues`.
- Produces: the images the controller shows next to each other in the companion for the user's approval (spec 4.1: "Before approval, each PDF is rendered and shown next to its approved mockup"). The controller builds that screen; this task only writes the files and reports their paths.

Tools checked on this Mac: `pdftoppm`, `mutool`, `gs` and ImageMagick are not installed; `sips` (built in) renders page 1 of a PDF to PNG; Google Chrome is installed for the mockup screenshots. There are no mockup screenshots yet, so this task makes them from the approved HTML. The Acord reference combines the two approved pieces exactly: `document-v4.html` ("Propus") with its site-only footer replaced by the full-page footer of `legal-footer-v2.html` (option B), the 2026-10-05 typo fixes and "mai 2027". The Cerere reference is the last full page of `legal-footer-v2.html` (option B).

- [ ] **Step 1: Add the preview writer**

`src/club/documents/__tests__/preview.test.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { renderDocument } from '../pdf/render';
import type { DocumentSeason } from '../types';
import { blankValues, registrationValues } from '../values';

/** Visual check only: DOCUMENT_PREVIEW_DIR=<dir> npx vitest run src/club/documents/__tests__/preview.test.ts */
const OUT = process.env.DOCUMENT_PREVIEW_DIR;
const SEASON: DocumentSeason = { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270 };
// The mockups' own invented sample (document-v4.html, gen_adeziune.py).
const SAMPLE = {
  documentId: 'reg0000000000000000000001',
  registrationNumber: '2026-0142',
  parentName: 'Mihaela Dumitrescu',
  phone: '07xx xxx xxx',
  email: 'parinte@exemplu.ro',
  relationship: 'parinte',
  childName: 'Maria Dumitrescu',
  childBirthDate: '2014-03-14',
  membershipAnswer: 'da',
  submittedAt: '2026-10-03T08:00:00.000Z',
};

it.runIf(Boolean(OUT))('writes the four PDFs for the visual check', async () => {
  const dir = path.resolve(OUT as string);
  mkdirSync(dir, { recursive: true });
  const filled = registrationValues(SAMPLE, SEASON);
  writeFileSync(path.join(dir, 'acord.pdf'), await renderDocument('acord', filled));
  writeFileSync(path.join(dir, 'adeziune.pdf'), await renderDocument('adeziune', filled));
  writeFileSync(path.join(dir, 'acord-gol.pdf'), await renderDocument('acord', blankValues(SEASON)));
  writeFileSync(path.join(dir, 'adeziune-gol.pdf'), await renderDocument('adeziune', blankValues(SEASON)));
});
```

Run: `npm test -- src/club/documents/__tests__/preview.test.ts`
Expected: 1 skipped (no `DOCUMENT_PREVIEW_DIR`).

- [ ] **Step 2: Render the PDFs and turn them into PNGs**

```bash
OUT=/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/pdf-check-v1
DOCUMENT_PREVIEW_DIR="$OUT" npm test -- src/club/documents/__tests__/preview.test.ts
for f in acord adeziune acord-gol adeziune-gol; do sips -s format png -Z 1600 "$OUT/$f.pdf" --out "$OUT/$f.png" >/dev/null; done
ls "$OUT"
```

Expected: 1 passed; `acord.pdf acord.png acord-gol.pdf acord-gol.png adeziune.pdf adeziune.png adeziune-gol.pdf adeziune-gol.png`. (If `sips` is missing: `qlmanage -t -s 1600 -o "$OUT" "$OUT/acord.pdf"` writes `acord.pdf.png`.)

- [ ] **Step 3: Screenshot the approved mockups**

Save as a scratch file outside the repo (for example in the session scratchpad) as `compose-refs.py` and run `python3 compose-refs.py "$OUT"`:

```python
import re, sys
M = '/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens'
OUT = sys.argv[1]
doc = open(M + '/document-v4.html').read()
leg = open(M + '/legal-footer-v2.html').read()

def block(s, start):
    i = s.find(start); depth = 0
    for m in re.finditer(r'<div\b|</div>', s[i:]):
        depth += 1 if m.group() != '</div>' else -1
        if depth == 0:
            return s[i:i + m.end()]

styles = ''.join(re.findall(r'<style>.*?</style>', doc, re.S))
footer_styles = ''.join(st for st in re.findall(r'<style>.*?</style>', leg, re.S) if '.f4' in st or '.ff' in st or '.kv' in st)
acord = block(doc[doc.find('<h3>Propus</h3>'):], '<div class="d2"')
footer = block(leg[leg.rfind('<div class="d2f"'):], '<div class="d2f"')
acord = acord.replace('<div class="d2f"><span>scoaladepatinaj.com</span></div>', footer)
for old, new in [('nascut', 'născut/ă'), ('sa particip/e', 'să participe'), ('dupa caz', 'după caz'), ('Semnatura', 'Semnătura'), ('iunie 2027', 'mai 2027')]:
    acord = acord.replace(old, new)
cerere = block(leg[leg.rfind('<div class="d2"'):], '<div class="d2"')
wrap = '<div class="A" style="padding:20px;background:#fff">{}</div>'
open(OUT + '/acord-mockup.html', 'w').write(styles + footer_styles + wrap.format(acord))
open(OUT + '/adeziune-mockup.html', 'w').write(''.join(re.findall(r'<style>.*?</style>', leg, re.S)) + wrap.format(cerere))
```

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in acord-mockup adeziune-mockup; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=600,940 \
    --virtual-time-budget=8000 --screenshot="$OUT/$f.png" "file://$OUT/$f.html" 2>/dev/null
done
rm "$OUT"/*-mockup.html
ls "$OUT"/*.png
```

Expected: six PNGs. Look at each pair before handing over: same header, title, clause list, consent frame, signature row and 4-column footer; values bold on the light tint; Da / Nu boxes empty; the blank forms show only Sezonul, the period (and the fee on the Cerere). The Acord body is slightly smaller than the mockup (it is shrunk to fit one page, D1); the mockup itself is 885 px tall, more than one A4 page. The Cerere and footer mockups still show the paper's cedilla s/t; the PDFs use ș/ț (D3).

- [ ] **Step 4: Commit the preview writer and report**

```bash
git add src/club/documents/__tests__/preview.test.ts
git commit -m "test(documents): preview writer for the visual check of the PDFs"
```

Report the folder `../edusport_frontend/docs/portal/mockups/screens/pdf-check-v1/` to the controller. Do not commit anything in the frontend repo; the controller shows the pairs in the companion and records the user's answer in DECISIONS.md.

---

## Handled by later plans

- 2B (admin): the "Formulare goale" button in the Înscrieri header (calls `GET /api/club/documents/blank/acord|adeziune`), the Documente tab of the Înscrieri panel (calls `GET /api/club/registrations/:documentId/documents/:kind`), the "Document refăcut" history line after an edit, written from the PUT response's `rebuild` (D6; `rebuild.reason` is `'unknown-season'` when the new season has no Sezon and nothing was rebuilt, `'failed'` on an error), and adding `relationship`, `relationshipOther`, `membershipAnswer` to `EDITABLE_FIELDS`.
- 2C (form): the page `/inscrieri/link-expirat` (where an expired or bad download link is redirected, D5); the success screen link `${API}/api/forms/inscriere/documents?token=<downloadToken>&kind=<kind>` for each kind in `documents`; with `documents: []` it shows no link; the singular / plural sentence follows `documents.length`.
- 2F (e-mail): attaches `listRegistrationDocuments(strapi, id)`; calls `enqueueRegistrationEmail(strapi, saved.documentId)` in `submitPublic` after `finishSubmit` when `saved.ok` (the variable `saved` is kept for this). Editing never e-mails; only "Retrimite e-mailul" does.
- Phase 8 (Documente page): listing, ZIP, uploaded documents.

## Notes for later plans

- Admin downloads go through the admin fetch client (Bearer token), so the admin UI must read the response as a blob (`responseType: 'blob'` or `fetch(...).then((r) => r.blob())`) and save it under the name in `Content-Disposition`; a plain `<a href>` would not carry the token.
- The public link is a plain browser link: an expired or bad token is redirected to `<site>/inscrieri/link-expirat`; an unknown kind (400) or a missing file (404) still answers JSON.
- `PRIVATE_FILES_DIR` must stay unset in production: the volume and `scripts/backup.sh` use the default `/opt/app/private`.
- Before deploying: set `DOCUMENT_TOKEN_SECRET` (32+ characters) in the VM's `.env.production`, otherwise every registration gets a 503; the club confirms the legal numbers before going live (D2).
- Rendering is synchronous within the submit request (about 0.4 s for the Acord, 0.07 s for the Cerere).

## Decisions applied (user, 2026-10-21)

1. D1 page fit: the Acord keeps the full 4-column legal footer; its body is shrunk to fit one page (about 88%, body text about 7.8 pt). The approved document-v4 plus the approved footer measure 885 px in Chrome against 792 px for A4; the Cerere fits at full size (Task 7).
2. D2 legal numbers: the values of the approved mockups (`gen_legal.py`, `gen_legal3.py`, from the club's paper Cerere) are printed from `src/club/documents/association.ts`. Deploy checklist: the club confirms them before going live (Task 4).
3. D3 letters: ș/ț with the comma below everywhere, the Cerere and the O.G. sentence included; tests pin that the PDF text has no U+015E, U+015F, U+0162, U+0163 (Tasks 5, 7).
4. D4 wordmark: Climate Crisis bundled next to Inter, both OFL (Task 1).
5. D5 expired or bad link: 302 redirect to `<site>/inscrieri/link-expirat`, the site being the first entry of the existing `FRONTEND_ORIGIN` (no new variable); 2C builds the page (Task 8, redirect test; Task 9).
6. D6 "Document refăcut": 2B writes it from the PUT response's `rebuild: { ok, documents }` (Task 8 provides the field).
7. D7 delete: deleting a registration from the admin deletes its stored PDFs; idempotent when they are missing. Extended by the controller to `deleteArchivedSeason`: ids read first, rows deleted, then every folder, a failing folder logged without stopping the others (Tasks 6, 8, 9).
8. Cross-plan review I1 (season moves): `moveSeason`, `moveWholeSeason` and a PUT of `season` set `seasonRef` to the Sezon of the new label (null when none) and rebuild the PDFs, one registration at a time, failures logged; with no Sezon the rebuild is skipped with a logged reason and the old PDFs stay. The number never changes (D2). M11: `touchesDocuments`, `DOCUMENT_FIELDS`, `rebuildDocuments`, `rebuildAfterEdit`, `RebuildResult` exported from `index.ts` (Task 8).

## Conflicts with the contract or the spec

- Contract signatures are kept exactly. Changed from the contract's wording: the public route answers an expired or bad token with a 302 redirect to the site page (D5) instead of an error. Additions: `deleteRegistrationDocuments`, `deleteRegistrationsWithDocuments`, `rebuildDocuments`, `rebuildAfterEdit`, `RebuildResult`, `touchesDocuments`, `DOCUMENT_FIELDS`, `seasonIdForLabel`, `moveRegistrationsToSeason`, `seasonMoveDeps`, `renderBlankDocument`, `finishSubmit`, `submitBlockedReason`, `RegistrationNotFoundError`, `documentTokenSecret`, `DOWNLOAD_TOKEN_TTL_MS` exported from `src/club/documents/index.ts`; the PUT response gains `rebuild` only when a printed field changed; the move routes keep their `{ moved }` responses.
- Plan 2A's internal interface changes: `SubmitResult` success gains `documentId`, `SubmitDeps.createNumbered` returns `{ documentId, registrationNumber }`; one 2A test is updated (Task 8 Step 3). The public response never carries `documentId`.
- Spec 4.1 asks for the `adeziune-v2` layout; `mockups/screens/` has only `adeziune-v3.html`. The plan follows the generator the 2026-10-05 decision names (`gen_adeziune.py`), plus the footer of `legal-footer-v2.html` option B, which is what v3 shows.
- "Submit fails closed" is implemented as 503 with 2A's existing code `save-failed` (no new error code for 2C), checked before anything is saved.
- The dispatch asked for Inter only; the approved header also needs Climate Crisis (D4).
- Plan 2A's rule "ș and ț use the comma below" now also covers the club's Cerere and footer text (D3), which were cedilla on paper.

## Self-review

1. Spec coverage (4.1, 3.4, 5) and the 2026-10-21 decisions D1-D7 (each mapped above): pdfkit (Tasks 1, 7); Acord for every registration and Cerere for Da (Task 2 `documentKindsFor`, Task 8 service); layouts and text word for word with the typo fixes, link, header, 4-column footer, O.G. sentence, dd.mm.yyyy, empty Da / Nu boxes, Data and signature, one page (Tasks 5, 7, render tests); values from registration, Sezon and association (Tasks 2, 5); Inter under OFL (Task 1); rendered next to the mockup before approval (Task 10); private folder outside `public/`, file names without diacritics, admin routes and 24-hour token, backup (Tasks 4, 6, 8); rebuild on edit, new file first, no e-mail (Tasks 6, 8); blank forms with season, period, fee (Tasks 2, 8); token tests valid, expired, wrong registration (Task 6); PDF text content and visual check (Tasks 7, 10). The "Formulare goale" button itself is 2B.
2. Placeholder scan: no TBD or "similar to"; every code step has the full file or the exact replacement.
3. Type consistency: `DocumentKind`, `StoredDocument`, `DocumentValues`, `Run`, `PlacedRun`, `Col` and the contract functions are defined once and used with the same names and shapes across Tasks 2-10; the code was run together.
4. Review Focus: each of the seven lines has its test in the owning task (Tasks 6, 7, 8, 9).

Execution: this plan was written under an execution method already chosen by the controller; it only asks for review.
