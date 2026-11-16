# Admin Polish Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the admin polish items (the original ten plus the 2026-11-16 amendments: layout, Sportivi and Înscrieri panels, Grupe coaches, abonament, Competiții) (phone handling in Înscrieri, Prețuri/Grupe links, per-session Tabele subject, shorter copy, one dropdown look, phone top bar, light e-mails, device hygiene, calendar filters, 16px selects) across the backend and frontend repos.

**Architecture:** Rules go in pure `src/club/**` modules with Vitest tests; admin components stay thin and are pinned by source-reading tests in `src/club/__tests__/`. Phone parsing is one `libphonenumber-js` rule used by the server, the admin and (separately bundled) the site form. Copy is applied last, area by area, from the two audits.

**Tech Stack:** Strapi 5.52.1 + TypeScript + Vitest (backend, `edusport_backend` worktree `.claude/worktrees/polish`, branch `feat/admin-polish`); Next.js + `node --test` scripts (frontend, `edusport_frontend` worktree `.claude/worktrees/polish`, branch `feat/polish`); `libphonenumber-js` (new in both).

**Spec:** `docs/superpowers/specs/2026-11-16-admin-polish-design.md` (this repo). Copy audits: `docs/superpowers/specs/2026-11-16-copy-audit-admin.md`, `docs/superpowers/specs/2026-11-16-copy-audit-portals.md`.

Paths are relative to the backend worktree unless a task says **Frontend**. Each task names its repo.

## Global Constraints

- Copy: Romanian with diacritics, no em dash, no en dash, no middle dot, no emoji, straight quotes "..." (spec header, CLAUDE.md). Missing copy is a question for the user, never invented.
- WhatsApp message text stays a `COPY NEEDED` constant (placeholders `{parinte}`, `{copil}`), one copy constant (spec 1).
- Phone: `libphonenumber-js`, default country RO; error text exactly "Numărul de telefon nu este valid."; stored E.164 (`+40722123456`); displayed international (`+40 722 123 456`); existing registrations never rewritten (spec 1).
- Warning tooltip "Număr de telefon invalid"; copy toast "Copiat."; WhatsApp opens `https://wa.me/<digits>?text=<message>` in a new tab; only status "Nou" becomes "Contactat" (spec 1).
- Site form loads `libphonenumber-js` only in the registration form bundle (spec 1).
- E-mails: `color-scheme` and `supported-color-schemes` meta light only, `:root{color-scheme:light only}`, white backgrounds also as `background-image:linear-gradient(#ffffff,#ffffff)`, outer area white instead of `#f3f4f6` (spec 7).
- Devices: 30 days unseen = not listed and ended when touched; same-label reuse; new-device mail only for a label unseen on that account in the last 30 days; "Ține minte dispozitivul" unchanged (spec 8).
- Calendar filter row label "Arată:" with the kit `Checkbox` and the same colour mark per type (spec 9).
- Select and menu triggers are 16px at phone width (spec 10, decided by Claude).
- Copy rules 1 to 5 of spec section 4 (no hints under inputs, star for required, "Opțional" goes; no subtitle restating the heading; rule or limit becomes a lock or info icon with the words in its tooltip; short repeated forms "Nu se poate anula.", "Nu s-a salvat. Verifică datele.", "Nicio X.", "Copiat."; dialogs keep one line). Server-matched strings change on both sides together. MesajePage diacritics fixed.
- Code rules (CLAUDE.md): no `any`, functions under 30 lines, complexity under 10, no dead code, admin UI only from `src/admin/ui` and tokens (`node scripts/admin-ui-check.mjs --strict` exits 0), no dashed lines, no pills or circles, buttons and badges flat.
- Behaviour tests only: no layout, colour, position or screenshot assertions.
- Per task verification (no long runs): `npx vitest run <touched files>`, `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`. The full `npm test` runs once at the end in a background worktree, never blocking a task.
- Commits: Conventional Commits, no AI attribution, never push.

## Review Focus

- Phone typed as "0722 123 456", "0722-123-456", "(0722) 123456", "0040722123456", "+44 20 7946 0958": all valid, stored E.164; "12345", "abc", "+40 12" refused with the spec text (Tasks 6, 7, 8). Pinned in Tasks 6 and 7.
- A legacy stored phone that does not parse (for example "0722 12"): list and panel show the warning icon, no crash, no WhatsApp link, value never rewritten; unchanged value saved through the admin edit form is not refused (Task 8).
- A device last seen exactly 30 days ago is still live; 30 days and one second is stale. Two different phones with the same label share one row and the second sends no mail (spec consequence, accepted) (Tasks 4, 5).
- "Prezență pe ședințe" for a group with no session in the month: only `Sportiv` and `Total` columns, no crash; a visitor (not on the list) is still a row; a month after the current month and a missing group are refused (Task 11).
- All four calendar categories unticked: empty calendar, boxes stay operable by keyboard; ticking again restores them (Task 10).
- A shortened string that takes arguments (`{nume}`, `{sumă}`, `{data}`) keeps every placeholder; shortened strings contain none of the banned characters (Tasks 12 to 16).
- Adaugă abonament: an athlete already a member sees the box ticked and no fee box; unticking never removes membership; a failed add writes neither membership nor fee (Task 24).
- Competiții tab for an athlete with no profile, or with the source down: zeros or the unavailable state, never a crash or a merged list (Task 25).

---

### Task 1: E-mails always light (backend)

**Files:**
- Modify: `src/email/registration-template.ts` (`HEAD` const ~line 165, `emailPage` ~line 178)
- Test: `src/email/__tests__/registration-template.test.ts`

**Interfaces:**
- Consumes: `emailPage(bodyHtml: string, links: EmailLinks): string`, shared by the registration, schedule-change, payment and portal e-mails.
- Produces: no signature change.

- [ ] **Step 1: Write the failing tests** in `registration-template.test.ts`
  - `it('declares light only colour scheme')`: `emailPage('<p>x</p>', links)` contains `<meta name="color-scheme" content="light only">`, `<meta name="supported-color-schemes" content="light only">` and `:root{color-scheme:light only}`.
  - `it('keeps every white background Gmail-proof')`: html contains `background-image:linear-gradient(#ffffff,#ffffff)` and does not contain `#f3f4f6`.
  - `it('applies to every e-mail that uses the frame')`: render one schedule-change e-mail (`schedule-change-template`) and assert the same `color-scheme` meta is present.
- [ ] **Step 2: Run** `npx vitest run src/email/__tests__/registration-template.test.ts` Expected: FAIL (meta missing, `#f3f4f6` present).
- [ ] **Step 3: Implement** in `HEAD` add the two metas and `:root{color-scheme:light only}` inside the existing `<style>`; in `emailPage` replace both `#f3f4f6` (body, outer table `bgcolor`) with `#ffffff` and add `background-image:linear-gradient(#ffffff,#ffffff)` to the body, outer `td` and letter table styles. The footer border `#dfdddb` stays so the letter still reads against the white page.
- [ ] **Step 4: Run** the same command plus `src/email/__tests__/schedule-change.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add src/email/registration-template.ts src/email/__tests__/registration-template.test.ts
git commit -m "feat(email): always render e-mails in light mode"
```

---

### Task 2: Phone top bar (backend)

**Files:**
- Modify: `src/admin/MobileNav.tsx` (`NAV_CSS`, render), `src/admin/app.tsx` (tag Strapi's mobile header, next to the existing `data-edusport-*` tagging)
- Create: `src/club/admin-topbar.ts`
- Test: `src/club/__tests__/admin-topbar.test.ts`

**Interfaces:**
- Produces: `STRAPI_TOPBAR_ATTR = 'data-edusport-strapi-topbar'`; `isStrapiTopbar(f: { tag: string; position: string; top: number; height: number; hasMenuButton: boolean }): boolean` (pure structural rule used by `app.tsx`, same idea as the sticky-and-tall sidebar tagging).

- [ ] **Step 1: Read, do not guess.** Open the Strapi 5.52.1 admin sources in `node_modules/@strapi/admin` (the mobile header with Home, Content Manager, Media Library, account button and the Strapi burger) and write down its element, position and the facts that identify it. Put those facts into the `isStrapiTopbar` test fixtures.
- [ ] **Step 2: Write the failing test** `admin-topbar.test.ts`
  - `isStrapiTopbar` true for the header facts found in step 1, false for the desktop sidebar facts (tall sticky nav) and for an in-page card header.
  - source test: `readFileSync('src/admin/app.tsx')` contains `STRAPI_TOPBAR_ATTR`; `MobileNav.tsx` `NAV_CSS` contains `[data-edusport-strapi-topbar]` inside `@media (max-width: 640px)` with `display:none`; `NAV_CSS` contains no backtick (file warning: one stray backtick takes the admin down).
- [ ] **Step 3: Run** `npx vitest run src/club/__tests__/admin-topbar.test.ts` Expected: FAIL.
- [ ] **Step 4: Implement** `isStrapiTopbar`; tag the element in `app.tsx` with `STRAPI_TOPBAR_ATTR`. In `NAV_CSS` at `max-width:640px`: hide the tagged element; add a fixed bar `.edu-mnav-bar` (height 56px, `var(--theme-surface)`, bottom border `var(--theme-border)`, z-index below the burger panel) holding the EduSport logo on the left (`src/admin/edusport-logo.svg`, links to `DASHBOARD_TO`) and the existing burger on the right; add `body{padding-top:56px}` for the same media query (the toast viewport already assumes 56px). Pages stay reachable by URL; the desktop view is untouched.
- [ ] **Step 5: Run** the test, both `tsc` commands, `node scripts/admin-ui-check.mjs --strict`. Expected: PASS, exit 0.
- [ ] **Step 6: Commit**
```bash
git add src/admin/MobileNav.tsx src/admin/app.tsx src/club/admin-topbar.ts src/club/__tests__/admin-topbar.test.ts
git commit -m "feat(admin): phone top bar with logo and EduSport menu only"
```

---

### Task 3: One dropdown look and 16px selects on phones (backend)

**Files:**
- Modify: `src/club/ui-select.ts`, `src/admin/ui/Select.tsx` (trigger class), `src/admin/dashboard/SubmissionTable.tsx` (`MenuButton` ~line 583), `src/admin/ui/styles.ts` (select block ~line 521, plus one phone rule)
- Test: `src/club/__tests__/ui-select.test.ts`

**Interfaces:**
- Produces: `SELECT_TRIGGER_CLASS = 'ui-input ui-sel'` and `menuTriggerClass(active: boolean): string` (returns `SELECT_TRIGGER_CLASS + ' ui-sel--menu'` plus `' sbt-qf-on'` when active), both in `src/club/ui-select.ts`.

- [ ] **Step 1: Write the failing tests** in `ui-select.test.ts`
  - `menuTriggerClass(false)` starts with `SELECT_TRIGGER_CLASS`, contains `ui-sel--menu`, not `sbt-qf-on`; `menuTriggerClass(true)` also contains `sbt-qf-on`.
  - source tests: `Select.tsx` and `SubmissionTable.tsx` both import and use `SELECT_TRIGGER_CLASS`/`menuTriggerClass`; the `MenuButton` function source no longer contains `variant="secondary"`; `styles.ts` contains a `@media (max-width:640px)` rule with `.ui-input{font-size:16px}` (the repo has no such rule today, so it is added once and covers Input, Textarea, Select and MenuButton).
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/ui-select.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** `MenuButton` renders a `<button type="button">` with `menuTriggerClass(!!active)`, the label in a `ui-sel-val`-style span and the same `ui-sel-chev` + `IconChevronDown size={12}` as `Select`; keep its props, ref, `aria-haspopup`, `aria-expanded`, disabled and focus handling untouched. Add `.ui-sel--menu{width:auto;display:inline-flex}` (Select stays `width:100%`). Add the phone rule in `styles.ts`. Every caller (`BlankFormsMenu`, "Alte filtre", Export, Status, Nivel, RecordMenu, SavedRail, ColumnsPopover, GroupMenu, MemberMenu, PanelMenu, RowMenu, PlatiList, PauzeSection) keeps working with no edit.
- [ ] **Step 4: Run** the test, both `tsc`, `node scripts/admin-ui-check.mjs --strict`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit**
```bash
git add src/club/ui-select.ts src/admin/ui/Select.tsx src/admin/dashboard/SubmissionTable.tsx src/admin/ui/styles.ts src/club/__tests__/ui-select.test.ts
git commit -m "feat(admin): menu buttons take the select look, 16px triggers on phones"
```

---

### Task 4: Connected devices, shared rules and admin side (backend)

**Files:**
- Create: `src/club/security/device-life.ts`
- Modify: `src/club/admin-login/devices.ts` (`bindAdminDevice`, `listAdminDevices`), `src/club/admin-login/login.ts` (`bindDevice`: pass the clock and the family-ending call), `src/club/security/store.ts` (`updateAdminDevice` Pick gains `deviceKeyHash`, `strapiDeviceId`), the real security store and `src/club/security/__tests__/memory-security-store.ts` (parity), `src/club/security/__tests__/store-contract.ts`
- Test: `src/club/security/__tests__/device-life.test.ts`, `src/club/admin-login/__tests__/login.test.ts`, `src/club/security/__tests__/security-store.test.ts`

**Interfaces:**
- Produces (pure, used again by Task 5):
```ts
export const DEVICE_STALE_DAYS = 30;
type Life = { label: string; lastSeenAt: string; revokedAt: string | null };
export function isStale(lastSeenAt: string, now: Date): boolean;            // strictly older than 30 days
export function isLive(d: Life, now: Date): boolean;                         // not revoked and not stale
export function reusableRow<T extends Life>(rows: T[], label: string, now: Date): T | null; // not live, same label, newest lastSeenAt first
export function labelSeenRecently(rows: Life[], label: string, now: Date): boolean;          // any row (revoked or not) with that label seen within 30 days
```
- Changes: `bindAdminDevice(c: BindCtx, adminId, cookieValue)` keeps its return shape; `isNew` now means "send the new-device mail" (label unseen in 30 days). `BindCtx` gains `endFamily?: (strapiDeviceId: string) => Promise<void>`, filled in `login.ts` from the same Strapi handle `disconnectAdminDevice` uses (`adminSessionManager(strapi).invalidateRefreshToken(String(adminId), strapiDeviceId)`).

- [ ] **Step 1: Write the failing tests**
  - `device-life.test.ts`: `isStale` false at exactly 30 days, true at 30 days + 1 s; `isLive` false for a revoked row; `reusableRow` picks the not-live same-label row with the newest `lastSeenAt` and ignores a live row and another label; `labelSeenRecently` true for a revoked row seen 10 days ago, false at 31 days.
  - `login.test.ts` (admin): `it('a device not seen for 30 days is ended when touched')` (row gets `revokedAt`, `endFamily` called with its `strapiDeviceId`, a new key is issued); `it('a new login from a browser without cookie reuses the ended row with the same label')` (row count unchanged, row has the new `deviceKeyHash`, `revokedAt` null, `confirmedAt` null, `twoFactorUntil` null); `it('mails only for a label not seen in 30 days')` (first login of "Telefon, Safari": mail; clear cookie, login again: no mail; label last seen 31 days ago: mail); `it('lists no stale device')` via `listAdminDevices`; `it('keeps Ține minte dispozitivul')`: a live row with `twoFactorUntil` in the future still counts in `rememberedDevice`.
  - `store-contract.ts`: `updateAdminDevice` can set `deviceKeyHash` and `strapiDeviceId`.
- [ ] **Step 2: Run** `npx vitest run src/club/security/__tests__/device-life.test.ts src/club/admin-login/__tests__/login.test.ts` Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `device-life.ts`. In `bindAdminDevice`: load `rows = store.adminDevices(adminId)` first and compute `mailDue = !labelSeenRecently(rows, label, now)` before any change; cookie found and live: touch `lastSeenAt` (unchanged path); cookie found but stale: set `revokedAt`, `twoFactorUntil: null`, call `endFamily`; then `reusableRow(...)` found: `updateAdminDevice` with the new `deviceKeyHash`, `strapiDeviceId` (new UUID), `lastSeenAt`, `revokedAt: null`, `confirmedAt: null`, `twoFactorUntil: null`; otherwise create as today. `listAdminDevices` also filters `isLive`.
- [ ] **Step 4: Implement** the store parity (real store, memory store, contract) for the widened `updateAdminDevice`; run `npx vitest run src/club/security src/club/admin-login`. Expected: PASS. Run both `tsc`.
- [ ] **Step 5: Commit**
```bash
git add src/club/security src/club/admin-login
git commit -m "feat(security): end stale admin devices, reuse same-label rows, mail new labels only"
```

---

### Task 5: Connected devices, portal side (backend)

**Files:**
- Modify: `src/club/portal/auth/issue.ts` (`bindDevice`, `issueSession` mail condition), `src/club/portal/me-shared.ts` (`liveDevices`), `src/club/portal/store.ts` plus its fake (`updateDevice` Pick gains `deviceKeyHash`), real portal store
- Test: `src/club/portal/__tests__/` (existing auth/devices tests; add `device-life-portal.test.ts`)

**Interfaces:**
- Consumes: `isStale`, `isLive`, `reusableRow`, `labelSeenRecently` from Task 4.
- Changes: internal `Bound.newRow` becomes `Bound.mailDue: boolean`; `mailNewDevice` is called when `o.notifyNewDevice && bound.mailDue`. Reuse is scoped to the same `host` (portal devices carry a host).

- [ ] **Step 1: Write the failing tests** (`device-life-portal.test.ts`): stale cookie row ended and replaced; ended row with the same label and host reused (row count unchanged, `sessionId` rebound); same label on another host is not reused; mail only for a label unseen 30 days on that account; `listDevicesFor` omits stale rows; a live fresh row still runs `sessions.revokeDevice` before reuse (existing behaviour kept).
- [ ] **Step 2: Run** `npx vitest run src/club/portal/__tests__/device-life-portal.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** by mirroring Task 4 in `bindDevice(c, account, given, host)`; widen `updateDevice` in the interface, real store and fake.
- [ ] **Step 4: Run** `npx vitest run src/club/portal src/club/security`, both `tsc`. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add src/club/portal
git commit -m "feat(portal): same device rules as admin (stale, reuse, mail by label)"
```

---

### Task 6: Phone validation on the server (backend)

**Files:**
- Create: `src/club/phone.ts`
- Modify: `package.json` (`libphonenumber-js`), `src/club/registration-submit.ts` (`validateInput` ~line 148, `personFields` ~line 163)
- Test: `src/club/__tests__/phone.test.ts`, `src/club/__tests__/registration-submit.test.ts`

**Interfaces:**
- Produces (import from `libphonenumber-js/min`, default country `'RO'`, validity by `isValid()`):
```ts
export const PHONE_ERROR = 'Numărul de telefon nu este valid.';
export function normalizePhone(raw: string): string | null;                  // E.164 or null
export function formatPhone(raw: string): { text: string; valid: boolean };  // '+40 722 123 456' or the raw text with valid=false
export function whatsappDigits(raw: string): string | null;                  // E.164 without '+'
```

- [ ] **Step 1: Write the failing tests**
  - `phone.test.ts`: `normalizePhone` gives `'+40722123456'` for `'0722123456'`, `'0722 123 456'`, `'0722-123-456'`, `'+40 722 123 456'`, `'0040722123456'` (if the library refuses the `00` form, drop that case and report); `'+442079460958'` for `'+44 20 7946 0958'`; null for `'12345'`, `'abc'`, `'+40 12'`, `''`. `formatPhone('0722123456')` is `{ text: '+40 722 123 456', valid: true }`; `formatPhone('0722 12')` is `{ text: '0722 12', valid: false }`. `whatsappDigits('0722123456')` is `'40722123456'`.
  - `registration-submit.test.ts`: invalid phone returns `PHONE_ERROR` (not the config text "din câmpul ... nu este valid") and creates nothing; `'0722 123 456'` is stored as `'+40722123456'`; an empty phone still yields the existing missing-field error when required.
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/phone.test.ts src/club/__tests__/registration-submit.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** `phone.ts`; `npm install libphonenumber-js`. In `validateInput`, after the presence check and before `configCheck`, `if (input.phone && !normalizePhone(input.phone)) return PHONE_ERROR`; in `personFields` store `normalizePhone(i.phone) ?? i.phone`.
- [ ] **Step 4: Run** the same command, `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add package.json package-lock.json src/club/phone.ts src/club/registration-submit.ts src/club/__tests__/phone.test.ts src/club/__tests__/registration-submit.test.ts
git commit -m "feat(registration): validate and store phone as E.164"
```

---

### Task 7: Phone validation on the site form (Frontend)

**Files (Frontend worktree):**
- Create: `src/app/(site)/inscrieri/_phone.ts`
- Modify: `package.json` (`libphonenumber-js`), `src/app/(site)/inscrieri/_RegistrationForm.tsx` (`extraError` ~line 290)
- Test: `scripts/inscrieri/phone.test.mjs` (same pattern as `rules.test.mjs`: loads the `.ts` directly, skipped where `process.features.typescript` is false)

**Interfaces:**
- Produces: `PHONE_ERROR = "Numărul de telefon nu este valid."` and `phoneError(value: CustomAnswer | undefined): string | undefined` (undefined for empty or valid; same rule as the server: `libphonenumber-js/min`, default RO, `isValid()`).
- Consumes: `extraError(key, value)` hook of `_RegistrationForm.tsx` (already used for `childHeight`, `childBirthDate`).

- [ ] **Step 1: Write the failing tests** `phone.test.mjs`
  - `phoneError('0722 123 456')`, `'+40722123456'`, `'+44 20 7946 0958'`, `''`, `undefined` are `undefined`; `'12345'`, `'abc'`, `'+40 12'` equal `"Numărul de telefon nu este valid."`.
  - `it('loads libphonenumber only in the registration form')`: scanning `src` for `libphonenumber-js` imports finds exactly `src/app/(site)/inscrieri/_phone.ts`; `_RegistrationForm.tsx` imports `_phone`; `src/lib/strapi-forms.ts` (contact, voluntariat) does not.
- [ ] **Step 2: Run** `node --test scripts/inscrieri/phone.test.mjs` Expected: FAIL (file missing).
- [ ] **Step 3: Implement** `_phone.ts`; add `if (key === "phone") return phoneError(value);` in `extraError`; `npm install libphonenumber-js`. Leave `isValidPhone` in `strapi-forms.ts` untouched (other forms keep their loose rule).
- [ ] **Step 4: Run** `node --test scripts/inscrieri/*.test.mjs`, `npx tsc --noEmit`, `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit (frontend repo)**
```bash
git add package.json package-lock.json "src/app/(site)/inscrieri" scripts/inscrieri/phone.test.mjs
git commit -m "feat(inscrieri): live phone validation with libphonenumber"
```

---

### Task 8: Înscrieri phone actions (backend)

**Files:**
- Create: `src/club/inscrieri-phone.ts`, `src/admin/dashboard/inscrieri/PhoneActions.tsx`
- Modify: `src/admin/ui/icons.tsx` (add `IconCopy`, `IconWhatsapp`; square-frame style like `IconGlobe`), `src/admin/dashboard/inscrieri/DateTab.tsx` (phone row), `src/admin/dashboard/InscrieriPage.tsx` (phone column `render`, line ~78), `src/admin/dashboard/SubmissionTable.tsx` (`ColumnDef.render` receives `api` if it does not yet), `src/club/inscrieri-edit.ts` (phone field check)
- Test: `src/club/__tests__/inscrieri-phone.test.ts`, `src/club/__tests__/registration-edit.test.ts`

**Interfaces:**
- Consumes: `normalizePhone`, `formatPhone`, `whatsappDigits`, `PHONE_ERROR` (Task 6); `api.saveField(documentId, 'status', 'Contactat')` and `registrationStatus(row)`; `adminToast` from `src/admin/ui/Toast.tsx`.
- Produces:
```ts
export const WHATSAPP_MESSAGE = 'COPY NEEDED'; // user writes the text; placeholders {parinte}, {copil}
export const PHONE_COPY = { copied: 'Copiat.', invalid: 'Număr de telefon invalid', copy: 'Copiază', whatsapp: 'WhatsApp' };
export function whatsappMessage(names: { parinte: string; copil: string }): string;
export function whatsappUrl(raw: string, names: { parinte: string; copil: string }): string | null; // null when the phone does not parse
export function statusAfterWhatsapp(status: string): 'Contactat' | null;                           // 'Nou' only
```
`PhoneActions({ row, api })` renders the formatted number (or the raw value plus a warning icon whose tooltip is `PHONE_COPY.invalid`), a copy icon button (writes the E.164 or raw text, toast `PHONE_COPY.copied`) and a WhatsApp icon link (`target="_blank" rel="noopener noreferrer"`, absent when the phone is invalid); pressing WhatsApp calls `api.saveField(documentId, 'status', 'Contactat')` when `statusAfterWhatsapp` says so. Read-only (anonymized or archived) rows show the number only.

- [ ] **Step 1: Write the failing tests**
  - `inscrieri-phone.test.ts`: `whatsappUrl('0722123456', { parinte: 'Ana', copil: 'Mihai' })` equals `'https://wa.me/40722123456?text=' + encodeURIComponent(WHATSAPP_MESSAGE)` (placeholders replaced when the template has them: test with a template-filling helper using a local template `'Buna {parinte}, {copil}'`); `whatsappUrl('0722 12', ...)` is null; `statusAfterWhatsapp('Nou')` is `'Contactat'`, `'Contactat'`, `'Confirmat'`, `'Respins'` are null; `PHONE_COPY.copied` is `'Copiat.'`; `WHATSAPP_MESSAGE` contains `COPY NEEDED`.
  - source tests: `DateTab.tsx` and `InscrieriPage.tsx` use `PhoneActions`; `PhoneActions.tsx` imports only `src/admin/ui` and `club` modules.
  - `registration-edit.test.ts`: an admin edit that changes phone to an invalid value returns `PHONE_ERROR`; a valid new value is saved as E.164; an unchanged legacy value that does not parse is accepted.
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/inscrieri-phone.test.ts src/club/__tests__/registration-edit.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** `inscrieri-phone.ts`, the two icons, `PhoneActions.tsx` and the two call sites; the edit rule goes in `inscrieri-edit.ts` where the phone patch is built (my call: the admin edit applies the same rule only when the value changed, so wa.me always gets a parseable number and old rows are never forced to change).
- [ ] **Step 4: Run** the tests, both `tsc`, `node scripts/admin-ui-check.mjs --strict`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit**
```bash
git add src/club src/admin
git commit -m "feat(inscrieri): copy and WhatsApp actions on phone numbers"
```

---

### Task 9: Prețuri and Grupe links (backend)

**Files:**
- Modify: `src/club/groups/api-types.ts` (`GroupListRow` gains `priceList: NamedRef | null`), the Grupe list builder behind `GroupListPage` (`src/club/grupe/`), `src/club/price-admin.ts` (`AdminPriceList` gains `groups: { documentId: string; name: string }[]`; `buildAdminPrices` takes them), `src/club/price-admin-service.ts` (`PriceStore.groupsByList(): Promise<Record<string, { documentId: string; name: string }[]>>`; `loadAdminPrices`), real price store and its fake, `src/club/grupe/routes.ts`, `src/admin/dashboard/grupe/GrupeList.tsx`, `src/admin/dashboard/grupe/GroupPage.tsx`, `src/admin/pages/preturi/PriceListCard.tsx`, `src/admin/pages/preturi/SectionPrices.tsx`, `src/admin/pages/PreturiPage.tsx`
- Create: `src/club/preturi-routes.ts`
- Test: `src/club/__tests__/preturi-links.test.ts`, `src/club/__tests__/price-admin.test.ts`, `src/club/__tests__/price-admin-service.test.ts`

**Interfaces:**
- Produces: `PRETURI_PATH = '/plugins/edusport-preturi'`; `preturiTo(listId: string): string` (`?lista=<encoded id>`); `readPreturiQuery(search: string): { lista: string | null }`; `sectionOfList(lists: AdminPriceList[], listId: string | null): string | null` (the section tab holding that list).
- Consumes: `groupPageTo(documentId, season)` from `src/club/grupe/routes.ts`.

- [ ] **Step 1: Write the failing tests**
  - `preturi-links.test.ts`: `preturiTo('abc 1')` is `'/plugins/edusport-preturi?lista=abc%201'`; `readPreturiQuery('?lista=abc')` gives `{ lista: 'abc' }`, `''` gives null; `sectionOfList` returns the list's section id, null for an unknown id or null.
  - `price-admin.test.ts`: `buildAdminPrices` attaches `groups` per list; a list no group uses has `groups: []`.
  - `price-admin-service.test.ts`: fake and real `groupsByList` agree (store parity test).
  - source tests: `GrupeList.tsx` and `GroupPage.tsx` use `preturiTo`; `PriceListCard.tsx` uses `groupPageTo`; the card renders the groups block only when `list.groups.length > 0`; the `PreturiPage` reads `readPreturiQuery` and selects the list's section tab.
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/preturi-links.test.ts src/club/__tests__/price-admin.test.ts src/club/__tests__/price-admin-service.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** types, builders, store parity, routes, and the four admin edits. In Grupe the price list name is a link (a ghost text button via the kit, no raw anchors styling); in Prețuri each card lists the groups using it as links to `groupPageTo`, and the card named by `?lista=` scrolls into view. No data model change (`group.priceList` already exists).
- [ ] **Step 4: Run** the tests, `npx vitest run src/club/groups src/club/grupe`, both `tsc`, `node scripts/admin-ui-check.mjs --strict`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit**
```bash
git add src/club src/admin
git commit -m "feat(admin): link price lists and groups both ways"
```

---

### Task 10: Program calendar filters as checkboxes (backend)

**Files:**
- Modify: `src/plugins/component-preview/admin/src/calendar/CalendarView.tsx` (`FilterChips`, `CalendarToolbar`), `src/plugins/component-preview/admin/src/calendar/model.ts` (add `toggleCategory`), `src/plugins/component-preview/admin/src/calendar/styles.ts` (drop `.cal-filter*`, add the row), `src/plugins/component-preview/admin/src/ProgramOverviewEditor.tsx` (`toggleCat` uses `toggleCategory`)
- Test: `src/club/__tests__/calendar-filters.test.ts`

**Interfaces:**
- Produces: `toggleCategory(hidden: ReadonlySet<CalendarCategory>, cat: CalendarCategory): Set<CalendarCategory>` (new set, input untouched).
- Consumes: `FILTER_GROUPS` (labels unchanged: "Antrenament", "Școala de patinaj", "Competiție, cantonament, spectacol, eveniment", "Liber, vacanță, sărbătoare"), kit `Checkbox`.

- [ ] **Step 1: Write the failing tests** `calendar-filters.test.ts`
  - `toggleCategory` adds a missing category, removes a present one, does not mutate its argument; toggling all four then all four again returns an empty set.
  - source tests: `CalendarView.tsx` imports `Checkbox` from the kit, contains the label `Arată:`, renders one `Checkbox` per `FILTER_GROUPS` entry with a `cal-sw` mark and `data-calcat`, and contains no `aria-pressed` and no `Filtre` popover button; `ProgramOverviewEditor.tsx` uses `toggleCategory`.
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/calendar-filters.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** one wrapping row (`role="group"`, `aria-label="Arată:"` text visible as a label) at every width: the narrow popover and its button are removed (one row wraps on phones). Checked = shown. `CalendarToolbar` props stay the same.
- [ ] **Step 4: Run** the test, both `tsc`, `node scripts/admin-ui-check.mjs --strict`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit**
```bash
git add src/plugins/component-preview/admin/src src/club/__tests__/calendar-filters.test.ts
git commit -m "feat(program): calendar filters as a labelled checkbox row"
```

---

### Task 11: Tabele subject "Prezență pe ședințe" (backend)

**Files:**
- Create: `src/club/tables/rows-sedinte.ts`
- Modify: `src/club/tables/types.ts` (`Subject` adds `'sedinte'`), `src/club/tables/catalog.ts` (`CATALOG.sedinte`, fixed columns `sportiv` and `total`), `src/club/tables/definition.ts` (`SUBJECTS`), `src/club/tables/builder-state.ts` (`DEFAULT_COLUMNS.sedinte`), `src/club/tables/service.ts` (`rowsOf`/`runTable` branch), `src/club/tables/copy.ts` (subject label, scope errors), `src/admin/dashboard/sportivi/tabele/ControlRow.tsx` (group required, period list without "whole season" for this subject), `src/club/presence/attendance/group-matrix.ts` (export what the table needs, no second implementation)
- Test: `src/club/tables/__tests__/rows-sedinte.test.ts`, `src/club/tables/__tests__/tables-service.test.ts`, `src/club/tables/__tests__/export.test.ts`, `src/club/tables/__tests__/definition.test.ts`

**Interfaces:**
- Consumes: `readGroupMatrix(store, groupId, month, now): Promise<AdminResult<GroupMatrix>>` (`group-matrix.ts`; `GroupMatrix.columns: MatrixColumn[]` with `date`, `startTime`, `sessionId`, `occurrenceKey`; `rows: MatrixRow[]` with `cells`, `present`, `visitor`), `runQuery`, `tableXlsx` (unchanged).
- Produces:
```ts
export const SESSION_MARK = 'X';                                     // my call: a plain letter, no emoji
export const sessionKey = (c: MatrixColumn): string => `s:${c.occurrenceKey ?? c.sessionId}`;
export async function sedinteTable(store: PresenceStore, d: TableDefinition, today: string, now: { date: string; time: string }):
  Promise<AdminResult<{ columns: CatalogColumn[]; rows: TableRow[] }>>;
```
Columns are `sportiv`, then one `text` column per session (key `sessionKey`, label `DD.MM HH:MM`), then `total` (`number`, equals `MatrixRow.present`). A cell is `SESSION_MARK` when `grup || uscat`, else `null`. `runTable` replaces `d.columns` with the generated keys for this subject, so the 20-column cap of stored definitions does not limit it. Scope rule: `groupId` required and `period` must be `{kind:'month'}` or `{kind:'current'}` (never null = whole season; my call, because the group matrix is a month builder), month not after the current month; otherwise 400 with `TABLES_COPY.sedinteScope`.

- [ ] **Step 1: Write the failing tests**
  - `rows-sedinte.test.ts` (seed from `tables-seed.ts` plus sessions and attendances in November 2026): columns equal `['sportiv', 's:…', …, 'total']` in date and time order; an athlete present in two of three sessions has two `X` cells, one `null`, `total` 2; a visitor row exists; a group with no session in the month gives only `sportiv` and `total` and no error; labels look like `06.11 17:00`.
  - `tables-service.test.ts`: `runTable` with subject `sedinte` and no group returns status 400; with `period: null` returns 400; with a month after the current month returns 400; with a valid scope returns the generated columns; filters on `sportiv` and a sort on `total` work.
  - `export.test.ts`: `tableXlsx` of a 25-session result writes a sheet with 27 header cells (generated columns are not capped).
  - `definition.test.ts`: `readDefinition` accepts subject `sedinte` with columns `['sportiv','total']` and rejects an unknown column; `repairDefinition` keeps scope.
- [ ] **Step 2: Run** `npx vitest run src/club/tables` Expected: FAIL.
- [ ] **Step 3: Implement** `sedinteTable` on top of `readGroupMatrix` (month from `resolvePeriod`'s month or `monthOf(today)`), wire the subject through types, catalog, definition, default columns, service and copy; `ControlRow` shows the group select without the "all" option and the period select without "whole season" for this subject, and `setSubject` into `sedinte` fills a group and the current month when the scope lacks them (pure helper in `builder-state.ts`, tested in `builder-state.test.ts`).
- [ ] **Step 4: Run** `npx vitest run src/club/tables src/club/presence`, both `tsc`, `node scripts/admin-ui-check.mjs --strict`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit**
```bash
git add src/club src/admin
git commit -m "feat(tabele): attendance per session subject built on the group matrix"
```

---

### Task 12: Copy, admin 1: Înscrieri, Sportivi, Tabele (backend)

**Files:**
- Modify (audit sections "Înscrieri", "Sportivi"): `src/club/inscrieri-copy.ts`, `src/club/registration-panel.ts` (e-mail status line becomes status icon with aria-label "Urmează" / "Netrimis" / "Nu s-a putut trimite"; the line under a failed status is removed), `src/club/athletes/errors.ts`, `src/club/athletes/confirm-read.ts`, `src/club/presence/copy/core.ts` (shared error forms), `src/club/presence/copy/lifecycle.ts`, `src/club/personal-data/copy.ts`, `src/club/portal/access/copy.ts`, `src/club/portal/copy-admin.ts`, `src/club/sportivi/{list-view,record-view,search-view,merge-view}.ts`, `src/club/tables/{copy,query}.ts`, `src/admin/dashboard/InscrieriPage.tsx`, `src/admin/dashboard/SubmissionTable.tsx` (:666 toast), `src/admin/dashboard/inscrieri/*`, `src/admin/dashboard/sportivi/{DateTab,ProfileEditor,ProfileTab,AddAthleteDialog}.tsx`, `src/admin/dashboard/sportivi/tabele/ExportMenu.tsx`, `src/admin/ui/HelpTip.tsx` (new prop `icon?: 'info' | 'lock'`), `src/admin/ui/icons.tsx` (`IconLock`)
- Test: `src/club/__tests__/copy-admin-1.test.ts`, existing copy tests of the touched modules (`registration-copy.test.ts`, `registration-panel.test.ts`, `inscrieri-panel.test.ts`, `src/club/tables/__tests__`)

**Interfaces:**
- Consumes: `HelpTip` (kit), `IconWarning`, `IconClock`, `Field required` (star), `adminToast`.
- Produces: `HelpTip` accepts `icon?: 'info' | 'lock'` (default `'info'`), used by every ICON row in Tasks 12 to 14.

- [ ] **Step 1: Write the failing tests** `copy-admin-1.test.ts` asserting the audit's proposals verbatim, one `it` per pattern:
  - `it('uses the short repeated forms')`: delete confirms end with "Nu se poate anula." (InscrieriPage, sportiv delete "\"{nume}\" se șterge cu profilul public, rezultatele și sezoanele. Înscrierile rămân, fără legătură. Nu se poate anula.", merge "Rămâne fișa \"{nume}\". Cealaltă se șterge. Nu se poate anula."); `LIST_COPY.searchPlaceholder` is `'Nume, nr., telefon, e-mail'`; sportivi search is "Caută sportiv"; empty lists "Nicio înscriere." / "Niciun sportiv." / "Niciun rând."
  - `it('keeps placeholders')`: each shortened function-valued string called with `{nume}`, `{next}` style args still contains the argument.
  - `it('has no banned characters')`: the exported strings of the touched copy modules match none of `the banned-character class (en dash, em dash, middle dot, curly quotes) or an emoji`.
  - source tests: `AddAthleteDialog.tsx` has no "Opțional"; `sportivi/DateTab.tsx` marks the five required labels with `required` and no longer renders the "Obligatorii pentru" line; `ProfileEditor.tsx` uses `HelpTip ... icon="lock"` on the read-only name; access line under e-mail is a `HelpTip` with "Accesul trece la {e-mail}." / "Accesul se oprește."; `InscrieriPage.tsx` has no page subtitle.
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/copy-admin-1.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** every row of the audit sections "Înscrieri", "Sportivi" and the Tabele rows listed under "Sportivi" with the audit proposal as the exact text (REMOVE rows delete the element, ICON rows use `HelpTip`/status icons, SHORTEN rows use the proposal). Fix older tests that pin old strings.
- [ ] **Step 4: Run** `npx vitest run src/club`, both `tsc`, `node scripts/admin-ui-check.mjs --strict`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit**
```bash
git add src
git commit -m "refactor(copy): shorter messages in Înscrieri, Sportivi and Tabele"
```

---

### Task 13: Copy, admin 2: Grupe, Sezoane, Prezență, Bani, Prețuri, Program (backend)

**Files:**
- Modify (audit sections "Grupe", "Prezență", "Bani", "Prețuri", "Program"): `src/club/groups/copy/{grupe-ui,schedule,core,calendar-ui,new-season}.ts`, `src/club/groups/occurrences.ts`, `src/club/season-admin.ts`, `src/club/presence/copy/{prezenta-ui,attendance,payments,subscriptions,money-ui,core}.ts`, `src/club/price-admin.ts`, `src/admin/dashboard/grupe/{GroupDialog,ProgramDrawer,DatePanel,PanelShell}.tsx`, `src/admin/pages/{SezoanePage,PreturiPage,PaginaProgramPage,SetariSitePage}.tsx` (the "Prezență și plăți din" hint only), `src/admin/pages/sezoane/{SeasonDrawer,NewSeasonSteps}.tsx`, `src/admin/pages/preturi/{PriceListCard,PriceNotesCard,PriceItemDrawer}.tsx`, `src/admin/dashboard/{ProgramEditPage,ContabilitatePage}.tsx`, `src/admin/dashboard/bani/{RestanteTab,BaniBreakdown,PaymentWindow,ExtendModal}.tsx`, `src/admin/dashboard/PrezentaScreen.tsx`/`DeIncasatList.tsx` as needed
- Test: `src/club/__tests__/copy-admin-2.test.ts`, existing `src/club/groups/__tests__/copy-*.test.ts`, `src/club/presence/__tests__`, `src/club/__tests__/price-admin.test.ts`

**Interfaces:**
- Consumes: `HelpTip icon` (Task 12), `Field required`.

- [ ] **Step 1: Write the failing tests** `copy-admin-2.test.ts`, audit proposals verbatim:
  - `it('uses the short repeated forms')`: "Ștergi grupa \"{nume}\"? Nu se poate anula."; "Nimic programat."; "Niciun eveniment."; "Nicio ședință." / "Nicio lecție." / "Nicio oră."; "Nimic de încasat."; "Datele s-au schimbat. Reîncarcă." in all five modules that share it.
  - `it('Sezon nou wizard says it once')`: step 1 lead is "{next} devine sezonul curent la ultimul pas."; the "Ce se schimbă" list has the shortened lines; the removed step 2 muted line and the two tile captions no longer exist in `new-season.ts`.
  - `it('keeps placeholders')` and `it('has no banned characters')` as in Task 12 for these modules.
  - source tests: `GroupDialog.tsx`/`ProgramDrawer.tsx`/`DatePanel.tsx` have no "Opțional" and no Program public description; `PriceListCard.tsx` has no "Preț incomplet" notice and no `* are tooltip` line and marks tooltip rows with `HelpTip`; `SeasonDrawer.tsx` shows `HelpTip icon="lock"` with "Are înscrieri, nu se mai schimbă."; `BaniBreakdown.tsx` puts the "Plătit din ce s-a datorat în luna asta." tooltip on the "Încasat" header; `PaginaProgramPage.tsx` link card is one line "Se editează în pagina Program.".
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/copy-admin-2.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** every audit row of the five sections (exact proposal text; REMOVE deletes; ICON uses `HelpTip`). Update older tests that pin old strings.
- [ ] **Step 4: Run** `npx vitest run src/club`, both `tsc`, `node scripts/admin-ui-check.mjs --strict`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit**
```bash
git add src
git commit -m "refactor(copy): shorter messages in Grupe, Prezență, Bani, Prețuri and Program"
```

---

### Task 14: Copy, admin 3: Anunțuri, Setări, Securitate, Sheets, Altele (backend)

**Files:**
- Modify (audit sections "Anunțuri", "Setări", "Altele" and the Notes row): `src/club/anunturi/portal-history.ts`, `src/club/security/copy.ts`, `src/admin/dashboard/{AnunturiPage,AnuntEditPage,SheetsDialog,MesajePage,VoluntariPage,SponsoriPage,MembriEchipaPage,CompetitiiPage,CompetitieEditPage,DashboardPage,FormEditorPage,NavigationPage,FormularePage,ParteneriRezultatePage,FormResultsPage,VoluntariatEditPage,SubmissionTable}.tsx`, `src/admin/dashboard/formDefs.ts`, `src/admin/pages/{SetariSitePage,CursuriPage,RegulamentPage,RealizariPage,IstoricPage,PaginaEchipaPage,PaginaParteneriPage,EvenimentColaborareEditPage,EvenimenteColaborarePage,MomenteIstoricPage,DisciplinePage,ArticolEditPage,ArticolePage}.tsx`, `src/admin/{MobileNav}.tsx` (Strapi menu empty line), `src/admin/ui/{RepeatableList,TimeInput,GalleryGrid,InboxLayout,useUnsavedGuard,useSaveState}.ts(x)`, `src/admin/lib/contentApi.ts`, `src/plugins/component-preview/admin/src/{CalendarLink,SiteSettingsContactEditor}.tsx`
- Test: `src/club/__tests__/copy-admin-3.test.ts`, existing `src/club/security/__tests__/copy.test.ts`, `src/club/__tests__/anunturi-source.test.ts`

**Interfaces:**
- Consumes: `HelpTip icon` (Task 12).

- [ ] **Step 1: Write the failing tests** `copy-admin-3.test.ts`, audit proposals verbatim:
  - `it('uses the short save and error forms')`: `useSaveState.ts` success toast is "Salvat."; `contentApi.ts` validation error "Verifică câmpurile."; the five editors' save error "Nu s-a salvat. Verifică datele."; `useUnsavedGuard.tsx` "Modificările nesalvate se pierd."; delete confirms "Ștergi cererea? Nu se poate anula." and "\"{titlu}\" se șterge. Nu se poate anula."
  - `it('MesajePage has diacritics')`: `MesajePage.tsx` contains "Ștergerea nu a reușit." and "Se șterge definitiv." and none of "Stergerea", "reusit", "definitiva".
  - `it('removes hints under inputs')`: source tests that the hint strings listed in the audit rows (Cursuri 18 hints, SetariSite phone/WhatsApp/address hints, Sponsori three hints, Membru descriere hint) no longer appear; the Link hartă hint becomes a `HelpTip` with "Gol: căutare Google Maps. Altfel lipește linkul din Partajează."
  - `it('locks reorder with a tip')`: Sponsori and Membri lists show the disabled handle with `HelpTip icon="lock"` "Golește căutarea ca să reordonezi."; automatic messages show a lock with "Automat, nu se poate opri."
  - `it('keeps placeholders')` and `it('has no banned characters')` for `security/copy.ts` and `portal-history.ts` exports.
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/copy-admin-3.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** every audit row of those sections (33 subtitle and description removals count as one pattern: delete the subtitle and card description props, keep link-card buttons).
- [ ] **Step 4: Run** `npx vitest run src/club`, both `tsc`, `node scripts/admin-ui-check.mjs --strict`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit**
```bash
git add src
git commit -m "refactor(copy): shorter messages in Anunțuri, Setări, Sheets and site editors"
```

---

### Task 15: Copy, portals 1: coach portal and server-matched `archived` (Frontend + backend)

**Files (Frontend worktree):**
- Modify: `src/lib/portal/copy.ts` (audit section "Antrenor"), the coach screens that carry removed lines (`club/ClubTodayPopup.tsx`, `lectie/[id]/ScopeSheet.tsx`, `antrenament/TrainingForm.tsx`, `calendar/CalendarView.tsx`, `grupe/[id]/GroupView.tsx`, `modifica/{MoveSheet,RemoveSheet}.tsx`, `prezenta/{PresenceView,ReactivateDialog}.tsx`, `sportiv-nou/NewAthlete.tsx`, `sportiv/[id]/AthleteCard.tsx`, `concursuri/CompetitionsView.tsx`, `grupe/[id]/_program/*`, `profil/ProfileView.tsx`, `profil/setari/SettingsView.tsx`), `src/lib/portal/copy-shared.ts` rows for the coach side are left to Task 16
- Test: `scripts/portal/copy.test.mjs` (extend), `scripts/portal/server-strings.test.mjs` (new)

**Files (Backend worktree):**
- Modify: `src/club/portal/copy.ts:14` (`archived`)
- Test: `src/club/portal/__tests__/copy.test.ts`

**Interfaces:**
- Produces: `PRESENCE.archived` is `"Arhivată"` on both sides (my call, from the audit's lock icon with tooltip "Arhivată"; the long sentence goes). `STATES.noAccess` ("Nu mai ai acces la această grupă.") and `LOST_ATHLETE` ("Nu mai ai acces la acest sportiv.") stay as they are: the audit proposes no new text for them and missing copy is never invented. Each side pins its constant so a one-sided edit fails.
- Consumes: frontend comparisons by `===` in `PresenceView.tsx:129`, `LessonView.tsx:81`, `use-sportiv.ts:29`, `DocumentRow.tsx:28`, `upstream.ts:53`, `use-portal.ts:39`.

- [ ] **Step 1: Write the failing tests**
  - `copy.test.mjs`: `PRESENCE.archived === "Arhivată"`; `copy.PRESENCE` has the audit's short forms ("Niciun antrenament azi.", "Nicio ședință.", "Nimic programat.", "Copiat.", "Nu s-a putut copia.", "Rezultate indisponibile.", the four toast forms "Ședința din {day} anulată." / "mutată." / "se ține." / "ștearsă."); the existing banned-character test keeps passing over the new strings.
  - `server-strings.test.mjs`: pins `PRESENCE.archived`, `STATES.noAccess` and `LOST_ATHLETE` to the exact literals above (comment: same literals pinned in the backend `copy.test.ts`).
  - backend `copy.test.ts`: `PORTAL_COPY`'s `archived` is `'Arhivată'`, `noAccess` is `'Nu mai ai acces la această grupă.'`, `access/copy.ts` `noAccess` and `sportiv/holder.ts` `NO_ACCESS` are `'Nu mai ai acces la acest sportiv.'`.
- [ ] **Step 2: Run** frontend `node --test scripts/portal/*.test.mjs`; backend `npx vitest run src/club/portal/__tests__/copy.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** every "Antrenor" audit row: REMOVE rows delete the line and its screen element; ICON rows (archived lock with tooltip "Arhivată"; School program lock "Îl schimbă administratorul") use the portal's existing icon and tooltip pattern; SHORTEN rows use the proposal. Change backend `archived` in the same step.
- [ ] **Step 4: Run** frontend `node --test scripts/portal/*.test.mjs`, `npx tsc --noEmit`, `npm run lint`; backend `npx vitest run src/club/portal`, `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit, one per repo**
```bash
# frontend worktree
git add src scripts/portal && git commit -m "refactor(copy): shorter coach portal messages"
# backend worktree
git add src/club/portal && git commit -m "refactor(copy): portal archived message matches the shorter coach copy"
```

---

### Task 16: Copy, portals 2: athlete and parent portal, shared parts (Frontend)

**Files (Frontend worktree):**
- Modify: `src/lib/portal/copy-sportiv.ts`, `src/lib/portal/copy-shared.ts` (audit sections "Sportiv" and "Shared portal parts"), `src/app/_portal/ui/CopyButton.tsx`, `src/app/(sportiv)/**` screens named in the audit (athlete picker, `_ui/NoticesPanel.tsx`, `_parts/LastCompetitionCard.tsx`, `_parts/PromotionDialog.tsx`, `calendar/page.tsx`, `parcurs/page.tsx`, `plati/_parts/{LeftCard,TicketSheet}.tsx`, `setari/_parts/AccountRows.tsx`, `setari/sportiv/[athleteId]/page.tsx`), both portals' `not-found.tsx`, `invite/page.tsx`
- Test: `scripts/portal/copy.test.mjs`, `scripts/portal/server-strings.test.mjs`

**Interfaces:**
- Consumes: `STATES.noAccess` and `LOST_ATHLETE` stay unchanged (Task 15).

- [ ] **Step 1: Write the failing tests** (extend `copy.test.mjs` for the sportiv and shared modules): "Rezultate indisponibile.", "Nu s-a putut închide.", "Actualizat {date}.", "Felicitări, {firstName}!", "{name}", "Adaugă în telefon", "Nicio ședință.", "Decide antrenorul.", "Clasament oficial ›", "Plata la club.", "Invitația a expirat. Cere una nouă.", "Copiat.", "Nu s-a putut copia."; `NOT_FOUND.text` is removed and neither `not-found.tsx` renders a paragraph; source tests that `NoticesPanel.tsx` shows the failure once (toast only), `TicketSheet.tsx` uses an info tooltip "Se poate prelungi dacă școala are weekend liber.", `AccountRows.tsx` and the Date sportiv card use a lock with "Îl schimbă clubul" / "Le schimbă clubul"; the banned-character test covers the new strings and function-valued strings keep their arguments (`value("X","X","X")` contains `X`).
- [ ] **Step 2: Run** `node --test scripts/portal/*.test.mjs` Expected: FAIL.
- [ ] **Step 3: Implement** every audit row of the two sections.
- [ ] **Step 4: Run** `node --test scripts/portal/*.test.mjs`, `npx tsc --noEmit`, `npm run lint`, `npm run check:tokens`. Expected: PASS.
- [ ] **Step 5: Commit (frontend repo)**
```bash
git add src scripts/portal
git commit -m "refactor(copy): shorter athlete portal and shared messages"
```

---

## Amendments 2026-11-16 (tasks 17 to 26)

Approved after the first plan: layout (Tasks 17 to 20, from `docs/superpowers/specs/2026-11-16-layout-audit.md`, root causes R1 to R9), Sportivi, Înscrieri, Grupe, abonament and Competiții changes (Tasks 21 to 26).

**Execution order:** 1, 2, 3, 17, 18, 19, 20 (layout first: later tasks build on `--ui-inset`), then 4 to 11, then 21 to 26, then the copy tasks 12 to 16 last (they edit the same files). Task numbers are kept so the cross references above stay valid.

Extra Global Constraints for tasks 17 to 26:
- Layout values: `--ui-inset` is 16px, 12px at `max-width:640px`; fields gap 12 (`--ui-space-3`), blocks gap 16 (`--ui-space-4`); every control 34px; nothing keeps 13, 14, 15 or 18 as a horizontal inset; breakpoints are phone 640 and tablet 1024 (audit R1, R7, R8, R9).
- Wording: "preț nemembru" becomes "preț neafiliat", Prețuri "Preț non-membri" becomes "Preț neafiliați", column "Non-membri" becomes "Neafiliați"; "Membri" and "preț membru" stay.
- New copy not given here is marked `COPY NEEDED` in a single constant, never invented. Layout and visibility are checked by screenshots the user approves, never by assertions (behaviour tests only; source-reading tests may pin the token and class names).

---

### Task 17: Inset token and screenshot gate (backend)

**Files:**
- Modify: `src/admin/ui/styles.ts` (`.ui-ph`, `.ui-body`, `.ui-rail`, `.ui-sec-h/b/f`, `.ui-ecard-h/b`, `.ui-row-b`, `.ui-modal`, `.ui-drawer`, `.ui-sheet`; token declaration beside the scale vars), `src/admin/ui/tokens.ts` (`scaleVars`: `--ui-inset`, phone override)
- Create: `scripts/layout-shots.cjs` (adapted from the scratchpad `shots/audit.cjs`: args `--out <dir>`, pages Înscrieri, Sportivi record (first athlete), Setări, widths 1440, 820, 390, full page)
- Test: `src/club/__tests__/ui-inset.test.ts`

**Interfaces:**
- Produces: CSS variable `--ui-inset` (16px; 12px under `@media (max-width:640px)`), used by every later layout task.

- [ ] **Step 1: Capture the "before" set** with `node scripts/layout-shots.cjs --out <scratchpad>/layout-before` against the local environment (read only, port 1340). Expected: 9 PNGs.
- [ ] **Step 2: Write the failing test** `ui-inset.test.ts`: `scaleVars()['--ui-inset']` is `'16px'`; the generated CSS contains `--ui-inset:12px` inside a `max-width:640px` block; source test that `.ui-ph`, `.ui-body`, `.ui-rail`, `.ui-sec-h`, `.ui-sec-b`, `.ui-sec-f`, `.ui-ecard-h`, `.ui-ecard-b`, `.ui-row-b`, `.ui-modal`, `.ui-drawer-h`, `.ui-sheet-h` rules use `var(--ui-inset)` and none of their horizontal paddings is 13, 14, 15 or 18.
- [ ] **Step 3: Run** `npx vitest run src/club/__tests__/ui-inset.test.ts` Expected: FAIL.
- [ ] **Step 4: Implement** the token and apply it to the listed rules only (audit R1, R6): phone also sets `.ui-ph` and `.ui-body` to the token and `.ui-sec-b{padding:12px}`.
- [ ] **Step 5: Capture "after"** to `<scratchpad>/layout-after` and put both sets side by side for the user. **STOP: wait for the user's approval of the before/after images before Task 18 starts.**
- [ ] **Step 6: Run** the test, both `tsc`, `node scripts/admin-ui-check.mjs --strict`. Expected: PASS, exit 0. Commit:
```bash
git add src/admin/ui scripts/layout-shots.cjs src/club/__tests__/ui-inset.test.ts
git commit -m "feat(admin): one horizontal inset token"
```

---

### Task 18: Tables, tabs and page toolbars on the token (backend)

**Files:**
- Modify: `src/admin/ui/styles.ts` (`.ui-table th/td`, `.ui-table-bar`, `.ui-table-pager`, `.ui-inbox-head/tools`, `.ui-tabs`), `src/admin/dashboard/sportivi/styles.ts` (`.spv-*`, delete the `.spv-tabs` rule and phone overrides), `src/admin/dashboard/SubmissionTable.tsx` (`.sbt-*` styles, `.sbt-chk` first cell, `.sbt-ph/pb/pa`), `src/admin/dashboard/sportivi/tabele/styles.ts` (`.tbl-controls`), `src/admin/dashboard/prezenta/styles.ts` (`.pz-*`)
- Test: `src/club/__tests__/ui-inset.test.ts`

**Interfaces:**
- Consumes: `--ui-inset` (Task 17).
- Produces: flush-in-window table rule `.ui-win .ui-table th:first-child, td:first-child{padding-left:var(--ui-inset)}` and the same for `last-child` right padding (audit R2: not applied inside `.ui-body` or `.ui-sec-b`).

- [ ] **Step 1: Write the failing tests** (source pins): `.ui-tabs` rule contains `padding-inline:var(--ui-inset)`; `sportivi/styles.ts` has no `spv-tabs` and no hard-coded `18px` or `16px` horizontal padding; every `.spv-*`, `.sbt-*`, `.tbl-controls`, `.pz-*` rule that sets horizontal padding uses `var(--ui-inset)`; the flush-table first/last cell rules exist; vertical bar padding is 12.
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/ui-inset.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** audit R2, R3, R4 exactly as written there.
- [ ] **Step 4: Verify** with `scripts/layout-shots.cjs` for Sportivi, Înscrieri, Prezență, Tabele at 1440/820/390 and show the images to the user (no pixel assertions). Run both `tsc` and `node scripts/admin-ui-check.mjs --strict`. Expected: exit 0.
- [ ] **Step 5: Commit**
```bash
git add src/admin src/club/__tests__/ui-inset.test.ts
git commit -m "feat(admin): tables, tabs and toolbars use the inset token"
```

---

### Task 19: One card component, one rhythm, 34px controls (backend)

**Files:**
- Modify: `src/admin/ui/EditorCard.tsx`, `src/admin/ui/Section.tsx`, `src/admin/ui/styles.ts` (`.ui-sec*`, `.ui-ecard*`, `.ui-body`, `.ui-stack`, `.ui-input[type=date]`), every caller of the card kept after the merge (grep `Section` and `EditorCard`), `src/admin/dashboard/SubmissionTable.tsx` (`.sbt-fld`, `.sbt-ft-l .ui-input`), `src/admin/pages/securitate/layout.tsx` (gap 10)
- Test: `src/club/__tests__/ui-inset.test.ts`

**Interfaces:**
- Produces: `EditorCard` is the one card (props gain optional `variant?: 'plain'` for the old Section look, header `padding-block:12px`, body gap `var(--ui-space-3)`); `Section` becomes a thin wrapper re-exporting it so callers keep compiling, then is removed from callers in the same task (my call: keep `EditorCard`, because it already has title, description and header action).

- [ ] **Step 1: Write the failing tests** (source pins): `.ui-body{gap:var(--ui-space-4)}`; `.ui-input[type=date]` has `height:34px`; `.sbt-fld` has no `margin-bottom:11px`; `securitate/layout.tsx` gap is `var(--ui-space-3)`; `Section.tsx` no longer defines its own markup (`ui-sec-` classes appear nowhere in `src/admin`).
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/ui-inset.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** audit R5, R7, R8: fields 12, blocks 16, date input 34px, Înscrieri toolbar selects 34px (the same size as the search, not mixed).
- [ ] **Step 4: Verify** Setări, Voluntariat, Anunț edit, Competiție edit, Securitate, Înscrieri at 1440/820/390 with `scripts/layout-shots.cjs`; show to the user. Both `tsc`, `node scripts/admin-ui-check.mjs --strict`.
- [ ] **Step 5: Commit**
```bash
git add src/admin src/club/__tests__/ui-inset.test.ts
git commit -m "feat(admin): one card component, field gap 12, block gap 16, 34px controls"
```

---

### Task 20: One breakpoint set (backend)

**Files:**
- Modify: `src/admin/ui/styles.ts` (`.ui-two`, `.ui-rail`, `.ui-inbox`, `.ui-ofc-grid`, `.ui-grid2` media queries), `src/admin/dashboard/SubmissionTable.tsx` (`.sbt-split` 1040), `src/admin/dashboard/sportivi/tabele/styles.ts` (rail), `src/admin/ui/useMediaQuery.ts` callers if they use other widths
- Create: `src/club/ui-breakpoints.ts`
- Test: `src/club/__tests__/ui-breakpoints.test.ts`

**Interfaces:**
- Produces: `export const BP = { phone: 640, tablet: 1024 } as const;` and `phoneQuery`/`tabletQuery` strings built from it, used by the admin CSS builders and hooks.

- [ ] **Step 1: Write the failing tests**: `BP` values; `phoneQuery` is `'(max-width:640px)'`; source pins that `styles.ts` contains no `max-width:720px`, `900px` or `1040px` query and `.ui-two` stacks only at `BP.phone` (a rail is a fixed 240px column on tablet).
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/ui-breakpoints.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** audit R9: 820px width keeps two columns for forms, rails (Tabele, Meniu) stay a 240px column so "Tabele salvate" is never a tall empty block above the controls, inbox and `sbt-split` collapse at 1024. Check whether the EduSport sidebar drawer being open on load at 820 is a shell bug and report it (not fixed here).
- [ ] **Step 4: Verify** Tabele, Meniu, Mesaje, Parteneri at 820 with `scripts/layout-shots.cjs`; show the user. Both `tsc`, `node scripts/admin-ui-check.mjs --strict`.
- [ ] **Step 5: Commit**
```bash
git add src/club/ui-breakpoints.ts src/admin src/club/__tests__/ui-breakpoints.test.ts
git commit -m "feat(admin): one breakpoint set, tablet keeps two columns"
```

---

### Task 21: Sportivi Date tab and Acces portal, Înscrieri panel header (backend)

**Files:**
- Modify: `src/admin/dashboard/sportivi/DateTab.tsx`, `src/admin/dashboard/sportivi/AccessBlock.tsx`, `src/admin/dashboard/sportivi/ActiveSinceField.tsx` (if the A.C.S. field lives there), `src/admin/dashboard/inscrieri/DateTab.tsx` (`EditLabel`), `src/club/sportivi/record-view.ts`, `src/club/portal/access/copy.ts`, `src/admin/dashboard/sportivi/styles.ts`
- Create: `src/club/sportivi/access-badge.ts`
- Test: `src/club/__tests__/sportivi-date-tab.test.ts`, `src/club/sportivi/__tests__/access-badge.test.ts`

**Interfaces:**
- Produces: `accessBadge(state: 'none' | 'invited' | 'active'): { text: 'FĂRĂ ACCES' | 'INVITAT' | 'ACTIV'; tone: 'neutral' | 'warning' | 'success' }` (the three words are the user's); the badge is the kit `StatusBadge` (flat, square).
- Consumes: the existing access state read by `AccessBlock.tsx` (`src/club/sportivi/access-view.ts`).

- [ ] **Step 1: Write the failing tests**
  - `access-badge.test.ts`: the three states map to the three words and tones.
  - `sportivi-date-tab.test.ts` (source pins): the record `DateTab` renders a section header row titled "Date" whose right side holds "Editează" (and "Salvează" and "Renunță" in edit mode, no buttons below the form); no "Obligatorii pentru" line remains (`record-view.ts`); required labels carry `required` (star) in edit mode and `MissingMarker` stays in read view; "Membru A.C.S." with its season renders as a normal `Field` in the grid, not a side block; the Înscrieri `DateTab.tsx` puts "Editează" in the card header row, not next to the e-mail field (`EditLabel` removed); `AccessBlock.tsx` has a header row "Acces portal", the e-mail, then `accessBadge`, the action button at the right edge, and no "Fără acces în portal." (`access/copy.ts`).
  - behaviour: the button text per state is unchanged from today's copy (reuse existing constants, add none).
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/sportivi-date-tab.test.ts src/club/sportivi/__tests__/access-badge.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement**; at `max-width:640px` the Acces portal button drops to its own full-width line (CSS on the shared row class, token spacing only).
- [ ] **Step 4: Verify** Sportivi record and an Înscrieri detail at 1440/820/390 with `scripts/layout-shots.cjs`; both `tsc`, `node scripts/admin-ui-check.mjs --strict`, `npx vitest run src/club/sportivi src/club/__tests__`.
- [ ] **Step 5: Commit**
```bash
git add src
git commit -m "feat(sportivi): Date and Acces portal header rows, badge, A.C.S. as a field"
```

---

### Task 22: Sportivi list filter popup scroll and sort select (backend)

**Files:**
- Modify: `src/admin/dashboard/sportivi/ListToolbar.tsx`, `src/admin/dashboard/sportivi/styles.ts`, `src/admin/ui/FilterPanel.tsx` (if the popup layout lives there), `src/club/sportivi/list-view.ts`
- Test: `src/club/__tests__/sportivi-list-toolbar.test.ts`

**Interfaces:**
- Consumes: `useMediaQuery` and `phoneQuery` (Task 20).
- Produces: `showSortSelect(isPhone: boolean): boolean` in `list-view.ts` (true only on phone, where the list is cards).

- [ ] **Step 1: Write the failing tests**: `showSortSelect(true)` true, `showSortSelect(false)` false; source pins that `ListToolbar.tsx` renders the "Sortare" select only when `showSortSelect(...)`, and that the filter popup's left list and right content are two separate scroll containers (each has its own `overflow-y:auto` rule with a bounded max-height token, no shared scroller).
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/sportivi-list-toolbar.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement**; column headers already sort on desktop and tablet.
- [ ] **Step 4: Run** the test, both `tsc`, `node scripts/admin-ui-check.mjs --strict`.
- [ ] **Step 5: Commit**
```bash
git add src
git commit -m "feat(sportivi): independent filter popup scroll, sort select on phones only"
```

---

### Task 23: Grupe group page coaches row (backend)

**Files:**
- Modify: `src/club/grupe/group-view.ts` (`subtitle`), `src/admin/dashboard/grupe/GroupPage.tsx` (`CoachAccounts` ~line 44, subtitle ~line 84), `src/admin/dashboard/grupe/styles.ts`
- Test: `src/club/groups/__tests__/group-view.test.ts` (or the existing `phase4-views.test.ts` home of `subtitle`)

**Interfaces:**
- Produces: `subtitle(page)` returns section, price list name and athlete count only (no coaches); the price list is rendered as a link with `preturiTo` (Task 9).
- Consumes: `CoachAccounts` behaviour (each name opens that coach's "Cont portal" block) is kept.

- [ ] **Step 1: Write the failing tests**: `subtitle(page)` for a page with two coaches does not contain either coach name; contains the section name and athlete count; with no coaches the subtitle is unchanged; source pins that `GroupPage.tsx` renders a labelled row "ANTRENORI" (uppercase label via the kit label class) with each coach as a button-link that opens the account block, and that the price list link uses `preturiTo`.
- [ ] **Step 2: Run** `npx vitest run src/club/groups src/club/__tests__/phase4-views.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement**; a group without coaches shows no ANTRENORI row.
- [ ] **Step 4: Run** the tests, both `tsc`, `node scripts/admin-ui-check.mjs --strict`.
- [ ] **Step 5: Commit**
```bash
git add src
git commit -m "feat(grupe): coaches in their own labelled row, subtitle without them"
```

---

### Task 24: Adaugă abonament with A.C.S. choice, and neafiliat wording (backend)

**Files:**
- Create: `src/club/presence/subscriptions/audience.ts`
- Modify: `src/club/presence/subscriptions/add.ts` (accepts membership and fee choice), `src/club/presence/subscriptions/views.ts` (item list per audience), `src/club/presence/copy/subscriptions.ts` ("preț nemembru" to "preț neafiliat", new constants), `src/api/club/` add-subscription route and controller (body gains `member: boolean`, `addFee: boolean`), the athlete membership write used by the record (reuse that path, do not duplicate), `src/admin/dashboard/bani/AddSubscriptionWindow.tsx`, `src/admin/pages/preturi/PriceItemDrawer.tsx` ("Preț non-membri" to "Preț neafiliați"), `src/admin/pages/preturi/PriceListCard.tsx` (column "Non-membri" to "Neafiliați")
- Test: `src/club/presence/__tests__/subscription-audience.test.ts`, `src/club/presence/__tests__/subscriptions-add.test.ts`, `src/club/__tests__/price-admin.test.ts`

**Interfaces:**
- Produces:
```ts
export type Audience = 'member' | 'neafiliat';
export function audienceOf(member: boolean): Audience;
export function itemPrice(item: { memberPrice: number | null; nonMemberPrice: number | null }, a: Audience): number | null;
export function feeLine(member: boolean, wasMember: boolean, fee: number | null): { show: boolean; label: string } | null; // the "Adaugă cotizația (<fee> lei)" checkbox: only when turning membership on and a fee exists
```
`COPY NEEDED` constants (single place, `subscriptions.ts`): the "Membru A.C.S. <season>" checkbox label function and the "Adaugă cotizația (<fee> lei)" label function use the user's wording from the brief; any other new text is marked `COPY NEEDED`.
- Consumes: season `membershipFee` (`season.membershipFee`), the existing membership write used by the Sportivi record (A.C.S. status per season, `src/club/acs.ts` and `src/club/athletes/` path), `add.ts` payload.

- [ ] **Step 1: Write the failing tests**
  - `subscription-audience.test.ts`: `audienceOf(true)` is `'member'`; `itemPrice` returns `memberPrice` for member and `nonMemberPrice` for neafiliat; `feeLine(true, false, 50)` shows label with "50 lei"; `feeLine(true, true, 50)` is null (already member); `feeLine(false, false, 50)` is null; `feeLine(true, false, null)` is null.
  - `subscriptions-add.test.ts`: adding with `member: true` for a non-member makes the athlete an A.C.S. member for that season through the record's path and prices the subscription from `memberPrice`; with `member: false` for a member athlete it prices from `nonMemberPrice` and does not unset membership (my call: the box only turns membership on); `addFee: true` with membership turning on adds an amount to collect equal to the season fee and `addFee: true` without turning on is ignored; a missing season fee ignores `addFee`; nothing is written when the add fails (single transaction).
  - `price-admin.test.ts`: column and drawer labels say "Neafiliați" / "Preț neafiliați"; `subscriptions.ts` contains "preț neafiliat" and no "nemembru".
  - source pins: `AddSubscriptionWindow.tsx` has the checkbox at the top ticked from the athlete's membership, re-renders the item list on toggle without a request round trip, shows each option's price right-aligned (the select's `hint` slot) for the chosen audience, shows the optional fee checkbox only per `feeLine`.
- [ ] **Step 2: Run** `npx vitest run src/club/presence src/club/__tests__/price-admin.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** the pure rules, the service change (inside `store.transaction`), the controller body fields (validated), the window and the three wording edits.
- [ ] **Step 4: Run** `npx vitest run src/club/presence src/club/athletes src/club/__tests__`, both `tsc`, `node scripts/admin-ui-check.mjs --strict`.
- [ ] **Step 5: Commit**
```bash
git add src
git commit -m "feat(bani): A.C.S. choice and optional fee in Adaugă abonament, neafiliat wording"
```

---

### Task 25: Sportivi record "Competiții" tab (backend)

**Files:**
- Create: `src/club/sportivi/competitions-view.ts`, `src/admin/dashboard/sportivi/CompetitiiTab.tsx`
- Modify: `src/club/portal/sportiv/competitions.ts` and `src/club/portal/coach/competitions.ts` only to export what the admin reuses (the one results source: skate-results when the athlete has a slug, else hand-entered Strapi competitions, never merged; `skaterOf`, the sportiv `SportivCompetitionViews` list with season, sort and page), the admin athlete route and controller (`src/api/club/routes/`, area-guarded like the other record routes), `src/admin/dashboard/sportivi/AthleteRecordPage.tsx` (tab), `src/admin/dashboard/sportivi/api.ts`, `src/club/sportivi/record-view.ts` (tab list)
- Test: `src/club/sportivi/__tests__/competitions-view.test.ts`, `src/club/__tests__/athlete-routes.test.ts`

**Interfaces:**
- Consumes: the portals' existing results source (the builder behind `c.competitions` / `SportivCompetitionViews`; find it first, do not write a second one).
- Produces:
```ts
export type CompetitionLine = { date: string | null; name: string; category: string | null; placement: number | null; score: number | null };
export type CompetitionsSummary = { competitions: number; podiums: number; bestPlacement: number | null; bestScore: number | null };
export function summarize(lines: CompetitionLine[]): CompetitionsSummary;   // podium = placement 1 to 3
export function newestFirst(lines: CompetitionLine[]): CompetitionLine[];
export function bySeason(lines: (CompetitionLine & { season: string })[], season: string | null): CompetitionLine[];
```
Route: `GET /api/club/athletes/:id/competitions?season=` answers `{ available: boolean; seasons: string[]; season: string | null; summary; lines }`. Tab content (decided by Claude): four summary tiles (competiții, podiumuri, cel mai bun loc, cel mai bun scor), then a list with columns data, competiție, categorie, loc, scor, newest first, a season filter. Tab and tile labels beyond these words: `COPY NEEDED` constant `COMPETITII_COPY` in `competitions-view.ts`.

- [ ] **Step 1: Write the failing tests**
  - `competitions-view.test.ts`: `summarize([])` is all zero and nulls; placements 1, 2, 5 give podiums 2, best 1; best score is the maximum, null when no score; `newestFirst` orders by date descending with null dates last; `bySeason(…, null)` returns all.
  - route test: an athlete with a slug reads skate-results lines; an athlete without a slug reads hand-entered competitions; never both; no profile gives `available: true` with zeros; source down gives `available: false`; a coach without the Sportivi area is refused (403), same guard as sibling routes.
  - source pin: `record-view.ts` lists the "Competiții" tab after the existing tabs; `CompetitiiTab.tsx` uses only kit components.
- [ ] **Step 2: Run** `npx vitest run src/club/sportivi src/club/__tests__/athlete-routes.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** the pure view, the route over the shared source, and the tab (loading, unavailable and empty states reuse existing short copy: "Nicio competiție." per rule 4; the unavailable text is `COPY NEEDED`).
- [ ] **Step 4: Run** `npx vitest run src/club/sportivi src/club/portal src/club/__tests__`, both `tsc`, `node scripts/admin-ui-check.mjs --strict`.
- [ ] **Step 5: Commit**
```bash
git add src
git commit -m "feat(sportivi): Competiții tab with club results and summary"
```

---

### Task 26: Competiții page club statistics columns (backend)

**Files:**
- Modify: `src/admin/dashboard/CompetitiiPage.tsx` (columns near lines 311-312), the competition list endpoint or reader that produces `skaters_count` and `results_count`, `src/club/competitions/` stats helper (create `src/club/competitions/club-stats.ts` if no module exists)
- Test: `src/club/competitions/__tests__/club-stats.test.ts`

**Interfaces:**
- Produces: `clubStats(results: { athleteIsClub: boolean; placement: number | null }[]): { podiums: number; bestPlacement: number | null }` (club athletes only; podium = placement 1 to 3); list rows gain `podiums` and `best_placement`; two new columns "Podiumuri" and "Cel mai bun loc" placed after Sportivi and Rezultate, right aligned and sortable like their neighbours.

- [ ] **Step 1: Write the failing tests**: no club results gives `{ podiums: 0, bestPlacement: null }`; placements 4, 2, 1 give podiums 2 and best 1; a non-club athlete's podium is ignored; a null placement is ignored; source pin that the two headers exist in `CompetitiiPage.tsx` after "Rezultate".
- [ ] **Step 2: Run** `npx vitest run src/club/competitions` Expected: FAIL.
- [ ] **Step 3: Implement** `clubStats`, feed it where `results_count` is computed (one query, not one per row), add the columns; empty value shows "-" like the other numeric cells.
- [ ] **Step 4: Run** the test, both `tsc`, `node scripts/admin-ui-check.mjs --strict`.
- [ ] **Step 5: Commit**
```bash
git add src
git commit -m "feat(competitii): club podiums and best placement per competition"
```

---

## Self-Review

1. **Spec coverage (original items; amendments A to F are Tasks 17 to 26, ordered in the Amendments section):** 1 Înscrieri phone: Tasks 6, 7, 8. 2 Prețuri/Grupe: Task 9. 3 Tabele subject: Task 11. 4 copy: Tasks 12 to 16 (admin audit sections Înscrieri, Sportivi, Grupe, Prezență, Bani, Prețuri, Program, Anunțuri, Setări, Altele each in one task; portals audit Antrenor, Sportiv, Shared; server-matched strings and MesajePage diacritics covered). 5 dropdowns: Task 3. 6 phone bar: Task 2. 7 e-mails: Task 1. 8 devices: Tasks 4, 5. 9 calendar: Task 10. 10 16px: Task 3. No gap found.
2. **Step scan:** every code step names a signature or exact strings; no bodies; verification steps carry commands.
3. **Type consistency:** `normalizePhone`/`formatPhone`/`whatsappDigits`/`PHONE_ERROR` defined in Task 6 and used in Task 8; the frontend `phoneError` is separate by design (separate bundle). `isStale`/`isLive`/`reusableRow`/`labelSeenRecently` defined in Task 4, used in Task 5. `HelpTip icon` defined in Task 12, used in 13, 14. `toggleCategory` defined and used in Task 10. `preturiTo`/`groupPageTo` consistent in Task 9. `sessionKey`/`SESSION_MARK` local to Task 11.
4. **Review Focus:** each line has its test in the owning task (phone forms in 6 and 7, legacy phone in 8, device boundary in 4 and 5, empty session month in 11, all-unticked in 10, placeholders and banned characters in 12 to 16).
5. **Proportion:** about 4 times the spec's length, justified by 16 tasks across two repos with exact audit strings referenced rather than copied; the audits themselves (not repeated here) hold the per-row proposals.

## Decisions made by the plan author (flag if wrong)

- The repo has no 16px input rule today; Task 3 adds one on `.ui-input` at 640px.
- "Prezență pe ședințe" allows a month or the current month only (never the whole season); the cell mark is a plain `X`.
- Admin edit of a registration phone validates only a changed value (Task 8).
- Only `PRESENCE.archived` changes on the server-matched side; `noAccess` and `LOST_ATHLETE` keep their text because the audit gives none (Task 15).
- Aria labels "Copiază" and "WhatsApp" on the phone icon buttons are new minimal copy (Task 8).
- The calendar filter popover on phones is removed in favour of one wrapping row (Task 10).
