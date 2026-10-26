# Phase 3-1: Shared Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every shared admin piece that Înscrieri (3A) and Sportivi (3B) use, in `src/admin/ui`: the admin-wide custom Select (all 36 call sites switch at once), Radio, the Toast `action` ("Anulează"), BottomSheet (phone sheet, desktop dropdown, full-height variant), the filters-v3 FilterPanel, selected style E, option groups in SearchableSelect and the zi / lună / an BirthDatePicker, all on the UI reference page.

**Architecture:** The rules (keyboard and type-ahead of the Select, swipe-down, filter summaries, birth date parts and year range, popover arrow and nesting) live in pure modules `src/club/ui-*.ts` with Vitest tests; the admin bundle imports them at runtime (no DOM, React or Node imports, like `registration-panel.ts` today). The components in `src/admin/ui` are thin React on the existing Popover, Modal, layer stack and tokens; their CSS goes into `styles.ts`. Wiring that Vitest cannot reach is pinned by source-reading tests (the phase 2B pattern) and by a Playwright pass on the reference page and the migrated pages (Task 12).

**Tech Stack:** Strapi 5.52.1 admin (React 18, TypeScript `strict: true` in `src/admin`), the shared `src/admin/ui` library and tokens, Vitest 3 (Node), Python Playwright for the browser pass, Postgres 16 in a throwaway container.

**Spec:** `docs/superpowers/specs/2026-10-26-athletes-registrations-design.md`, section 8 (Shared admin UI), and every place it uses a shared piece: 3.1 (Înscrieri toolbar Select), 3.3 (status menu, tabs), 3.4 and 6.2 (birth date picker), 4.1 (choice cards, Radio), 4.3 (group picker under section names), 4.6 (toast "Anulează" for 8 seconds), 4.8 and 6.1 (full-height bottom sheet on phones), 5 (filters-v3, phone bottom sheet, "Arată N sportivi"), 9 (year range shared with the website). Decisions log: `../edusport_frontend/docs/portal/DECISIONS.md` (2026-10-06 bottom-sheet-v1, filters-v3, selected-state-v2, open-questions-v2 Q8; 2026-10-10 aloca-v2 (a); 2026-10-26 phase3a-r1 q29, gaps #32, #43, phase3ab "no pre-build phone render approvals"). Approved screens: `../edusport_frontend/docs/portal/mockups/screens/bottom-sheet-v1.html`, `bottom-sheet-v2.html`, `filters-v3.html`, `open-questions-v2.html` (question 8), `selected-state-v2.html`, `prototype-registrations-v5.html` (choice cards).

**Validated:** every file and edit below was applied to a scratch copy of `main` (2026-10-26, after the phase 2 merge): the new Vitest files pass (`ui-popover`, `ui-select`, `admin-select-migration`, `admin-radio`, `admin-toast-action`, `ui-sheet`, `admin-selected-style`, `ui-filters`, `ui-birth-date`: 53 tests), `npx tsc --noEmit -p src/admin/tsconfig.json` has zero errors, and `node scripts/admin-ui-check.mjs --strict` exits 0 with "all 0". The scratch copy had no `pdfkit` / `unpdf` installed, so the phase 2 documents tests and the server `tsc` failed there for that reason only; run `npm ci` first (Global Constraints). Task 12 (Strapi build and browser pass) was not run; it is the first run-time check.

## Needs decision

The spec leaves these open. Tasks 5 and 10 wait for answers 1 and 2 (Task 9 uses Radio, so it waits for 1 too). Items 3 to 6 do not block: the code below is written with option A so the tasks can run, and each owning task has an "If option B" step with the exact change.

1. **Radio mark shape** (Task 5; open-questions-v2 Q8 drew a round mark, the brief and the admin styles say no circles, square corners only).
   - A: round 16px mark as in the open-questions-v2 mock (an exception like the spinner): token `radio: '50%'`.
   - B: square mark with 4px corners, filled with the primary colour when chosen: token `radio: '4px'`.
2. **Birth date picker details** (Task 10; the website picker of spec 9 must match, so the website plan needs the same answers).
   - 2a labels. A: days `1` to `31`, months by name ("ianuarie" ... "decembrie"). B: days `01` to `31`, months `01` to `12`.
   - 2b year order. A: newest first (2024 at the top in 2026). B: oldest first.
   - 2c empty first row of each select. A: "Zi", "Lună", "An" (choosing it clears that part). B: no empty row; blank until chosen.
   - 2d impossible dates (31 April, 29 February 2015). A: the day list follows month and year; a picked day that no longer fits is cleared. B: always 31 days; saving an impossible date is refused with an error (copy needed).
3. **Filter section value when several are chosen** (Task 9). A: the chosen labels joined by ", ", cut with "..." when long. B: a count, e.g. "2 alese" (copy needed).
4. **Search box placeholder in a filter section with more than 8 options** (Task 9). A: "Caută..." (today's SearchableSelect default). B: no placeholder.
5. **Select list on phones** (Task 2; bottom-sheet-v1 lists "alegeri scurte" among BottomSheet uses). A: the same list under the field on every screen size, as SearchableSelect today. B: on phones the options open in a BottomSheet.
6. **Close X on the undo toast** (Task 6; gaps #32 says "toast 8 seconds with 'Anulează' only"). A: the toast keeps its X like every toast; "only" means no other action. B: no X on a toast that has an action.


> **Needs decision: RESOLVED (decided by Claude, low impact, 2026-10-26; logged in DECISIONS.md).** Executors use these answers:
> 1. Radio mark: square, same corner radius and size as the existing admin Checkbox (no-circles rule); selected = filled inner square.
> 2. Birth date picker: same as the website picker (plan 3-3): day labels 01 to 31, month names, years oldest first, empty first rows "Zi" / "Lună" / "An", all 31 days always listed; an impossible date is refused with "Alegeți data nașterii.".
> 3. Several chosen filter values: labels joined by commas (option A).
> 4. Search field in filter sections with more than 8 options: "Caută..." (option A).
> 5. Select list on phones: the same list under the field (option A).
> 6. Undo toast: "Anulează" only, no X (spec gap #32, option B).

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes` off `main` (shared with the other phase 3 plans). Run `npm ci` once on the branch before Task 1: without the phase 2 packages (`pdfkit`, `unpdf`) the server `tsc` and the documents tests fail for reasons outside this plan. The frontend repo is not touched by this plan (the website picker belongs to the spec 9 plan).
- Strapi 5.52.1, TypeScript, single quotes in `src/`. New functions < 30 lines, cyclomatic complexity < 10, no `any`. Existing functions already over the limit (`ToastCard`, `SearchableSelect`, `SubmissionTablePage`) are edited in place, not refactored.
- `src/admin` is excluded from Vitest: logic goes into `src/club/ui-*.ts` (pure: no DOM, React, Node or Strapi imports, so the admin bundle can import it at runtime); component wiring is pinned by source-reading tests in `src/club/__tests__/` and by the Task 12 browser pass.
- Checks after every task: the task's own test file (`npx vitest run <file>`), `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors) and `node scripts/admin-ui-check.mjs --strict` (exit 0, "all 0"). The full `npm test` and the server `npx tsc --noEmit` run once, in Task 12 (user rule: no long test runs per batch).
- `src/admin/ui/styles.ts` rules: colours only `var(--theme-*)`; radius only the `var(--ui-radius-*)` tokens the checker allows; every class `ui-` prefixed under `.ui-root`; no backtick inside the CSS string (one stray backtick blanks the admin); no dashed or dotted lines.
- Design: build from the approved screens listed under Spec and from prototype v5; reuse `Popover`, `Modal`, `layerStack`, `Button`, `Checkbox`, `Input`, `Field`; no rounded pills or circles (Radio: Needs decision 1); phone layout at `max-width: 640px`, the breakpoint Drawer, Toast and MobileNav use. Renders are reviewed by the user after implementation (DECISIONS phase3ab), from the Task 12 screenshots.
- Copy: Romanian, exactly as the spec and DECISIONS; ș and ț with the comma below; no em dash, no middle dot, no emoji; terse. Copy introduced here, all from the approved screens or existing components: "Filtre", "Toate", "Șterge tot", "Șterge", "Gata", "Arată N ..." (passed in by the caller), "Închide" (existing X label), "Zi", "Lună", "An", month names (Needs decision 2), "Caută..." (Needs decision 4).
- SaveBar tagger (`src/admin/app.tsx`, `tagDefaultSaveAndPreview`): a `<button>` named "Salvează" / "Publică" outside `.pce` or `.ui-root` is shrunk to 1px. Every surface built here (BottomSheet phone layer, dropdown Popover, Modal, Toast) portals with `.ui-root`, so a "Salvează" placed in a BottomSheet footer (athlete record on phones) is safe. Task 12 checks that nothing is tagged.
- Tests use synthetic data only. Never run anything against production, the user's local database (container `strapi_db`) or the running `strapi_app` container; Task 12 uses a throwaway Postgres on a free port.
- Commits: Conventional Commits, no AI attribution, no `Co-Authored-By`. Never push.
- Decide nothing the spec leaves open: anything new goes to "Needs decision" above.

## Review Focus

- A Select inside another popover (the Înscrieri "Alte filtre" builder, the desktop filter dropdown): picking an option must not close the outer popover, and Escape closes only the newest list. Today the native `<select>` list is not DOM, so this never came up. Pinned by Task 1 (`isInsideNewerPopover`, `isNewestPopover` tests) and Task 12 ("Alte filtre" stays open after a pick).
- A Select inside a Modal, Drawer or BottomSheet: the first Escape closes only the list, the second closes the dialog; Tab leaves without changing the value; the focus never leaves the dialog (focus stays on the Select button). Pinned by Task 2 (`selectKeyAction` tests) and Task 12 (two Escapes on the "Panou: fereastră" demo).
- Typing letters, with or without diacritics, also while the list is closed ("i" finds "Începători", "s" finds "Școala de patinaj"), the same letter cycles, disabled options are skipped. Pinned by Task 2 tests and the Task 12 type-ahead check.
- Birth dates: no impossible date ever comes out (31, then April; 29 February, then 2015), and a stored year outside 25 to 2 years ago stays in the list so opening an old record never loses it. Pinned by Task 10 tests and Task 12 (1998 listed).
- The undo toast: "Anulează" stays reachable before the 8 seconds end (the countdown waits while pointer or focus is on the toast), runs once (a double click does not undo twice) and closes the toast. Pinned by Task 6 source tests and Task 12.

---

## File Structure

```
src/club/
  ui-popover.ts            arrowOffset, isNewestPopover, isInsideNewerPopover (Task 1)
  ui-select.ts             foldText, stepIndex, edgeIndex, typeaheadIndex, selectKeyAction, scrollTopFor (Task 2); groupHeaderAt (Task 4)
  ui-sheet.ts              closeDistance, closesOnRelease, dragOffset (Task 7)
  ui-filters.ts            FilterChoice, sectionSummary, toggleChoice, needsSearch, matchOptions, activeSections (Task 9)
  ui-birth-date.ts         DateParts, daysInMonth, withPart, day/month/year choices, ZZ.LL.AAAA and ISO helpers (Task 10)
  __tests__/ui-popover.test.ts, ui-select.test.ts, admin-select-migration.test.ts, admin-radio.test.ts,
            admin-toast-action.test.ts, ui-sheet.test.ts, admin-selected-style.test.ts, ui-filters.test.ts, ui-birth-date.test.ts
src/admin/ui/
  tokens.ts                radius lg / sheet / handle (Task 1), radio (Task 5); zIndex sheet (Task 1)
  icons.tsx                IconChevronLeft, IconChevronRight, IconCheck (Task 1)
  useMediaQuery.ts         useMediaQuery, useIsPhone, PHONE_QUERY (Task 1)
  Popover.tsx              arrow option, nested popovers (Task 1)
  Select.tsx               rewritten: combobox button + shared list (Task 2)
  SearchableSelect.tsx     ComboOption.group headers (Task 4)
  Radio.tsx                Radio, RadioGroup (Task 5)
  Toast.tsx                ToastOptions.action (Task 6)
  BottomSheet.tsx          phone sheet, desktop dropdown, Modal fallback (Task 7)
  FilterPanel.tsx          filters-v3 (Task 9)
  Field.tsx                NoFieldContext (Task 10)
  BirthDatePicker.tsx      zi / lună / an (Task 10)
  styles.ts                CSS of every piece; select.ui-input rule removed (Task 3); selected style E (Task 8)
  index.ts                 exports
src/admin/dashboard/
  inboxShared.tsx          select.ui-input rule -> .ui-sel (Task 3)
  SubmissionTable.tsx      three comments that said <select> (Task 3)
  UiReferencePage.tsx, ui-reference/Phase3Demos.tsx (Task 11)
scripts/admin-ui-check.mjs radius tokens lg / sheet / handle / radio allowed (Tasks 1 and 5)
docs/admin-ui/PLAN.md      "Phase 3 shared pieces" (Task 11)
```

## Order

All tasks touch `styles.ts` and `index.ts`, so they run one after the other, in this order: 1, 2, 3, 4, 6, 7, 8, then 5 once Needs decision 1 is answered, 9 (needs 5 and 7), 10 once Needs decision 2 is answered, 11, 12. Each new CSS block goes in at its own anchor line, so the order of 5 / 9 / 10 against the others does not change the result.

---

### Task 1: Foundations: tokens, icons, media query hook, Popover arrow and nesting

**Files:**
- Create: `src/club/ui-popover.ts`, `src/admin/ui/useMediaQuery.ts`
- Modify: `src/admin/ui/Popover.tsx` (whole file), `src/admin/ui/tokens.ts:524-529` (radius) and `:595-600` (zIndex), `src/admin/ui/icons.tsx:25`, `src/admin/ui/styles.ts:404` (after `.ui-list`), `src/admin/ui/index.ts` (Popover export line), `scripts/admin-ui-check.mjs:8-11,151`
- Test: `src/club/__tests__/ui-popover.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `arrowOffset(anchorLeft, anchorWidth, popLeft, popWidth): number`, `isNewestPopover(open: readonly number[], seq: number): boolean`, `isInsideNewerPopover(seq: number, otherSeq: number | null): boolean`; `PopoverProps.arrow?: boolean` (sets `data-arrow`, `data-side`, `--ui-pop-arrow-x`); nested popovers: a pointer down inside a newer `.ui-pop` does not close an older one, Escape closes the newest only; tokens `radius.lg = '8px'`, `radius.sheet = '10px 10px 0 0'`, `radius.handle = '2px'`, `zIndex.sheet = 100150` (CSS `--ui-radius-lg|sheet|handle`, `--ui-z-sheet`); icons `IconChevronLeft`, `IconChevronRight`, `IconCheck`; `useMediaQuery(query: string): boolean`, `useIsPhone(): boolean`, `PHONE_QUERY = '(max-width: 640px)'`.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/ui-popover.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { radius, zIndex } from '../../admin/ui/tokens';
import { arrowOffset, isInsideNewerPopover, isNewestPopover } from '../ui-popover';

describe('arrowOffset', () => {
  it('points at the centre of the anchor', () => {
    expect(arrowOffset(100, 80, 100, 540)).toBe(40);
  });

  it('stays 14px away from the popover corners', () => {
    expect(arrowOffset(100, 10, 100, 540)).toBe(14);
    expect(arrowOffset(600, 80, 100, 540)).toBe(526);
  });
});

describe('nested popovers', () => {
  it('only the newest popover reacts to Escape', () => {
    expect(isNewestPopover([3, 7], 7)).toBe(true);
    expect(isNewestPopover([3, 7], 3)).toBe(false);
    expect(isNewestPopover([], 3)).toBe(false);
  });

  it('a pointer down in a newer popover does not close an older one', () => {
    expect(isInsideNewerPopover(3, 7)).toBe(true);
    expect(isInsideNewerPopover(7, 3)).toBe(false);
    expect(isInsideNewerPopover(3, null)).toBe(false);
  });
});

describe('tokens for the phase 3 layers', () => {
  it('the bottom sheet sits above a Drawer and under a Modal and a Popover', () => {
    expect(zIndex.drawer).toBeLessThan(zIndex.sheet);
    expect(zIndex.sheet).toBeLessThan(zIndex.modal);
    expect(zIndex.sheet).toBeLessThan(zIndex.popover);
  });

  it('dropdowns have 8px corners, the phone sheet rounded top corners', () => {
    expect(radius.lg).toBe('8px');
    expect(radius.sheet).toBe('10px 10px 0 0');
    expect(radius.handle).toBe('2px');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/__tests__/ui-popover.test.ts`
Expected: FAIL (`Failed to resolve import "../ui-popover"`).

- [ ] **Step 3: The pure rules**

`src/club/ui-popover.ts`:

```ts
/**
 * Placement and stacking rules of the admin Popover (src/admin/ui/Popover.tsx).
 * Pure: no DOM, no React, so Vitest covers them.
 */

/** Distance of the arrow from the popover's corners, in px. */
const ARROW_EDGE = 14;

/**
 * Arrow position inside a popover, in px from its left edge: under the
 * anchor's centre, kept away from the popover's corners.
 */
export function arrowOffset(anchorLeft: number, anchorWidth: number, popLeft: number, popWidth: number): number {
  const x = Math.round(anchorLeft + anchorWidth / 2 - popLeft);
  return Math.max(ARROW_EDGE, Math.min(popWidth - ARROW_EDGE, x));
}

/** Only the newest open popover (by opening order) reacts to Escape. */
export function isNewestPopover(open: readonly number[], seq: number): boolean {
  return open.length > 0 && open[open.length - 1] === seq;
}

/**
 * A pointer down inside a popover opened after this one (a Select list opened
 * from a filter dropdown or from "Alte filtre") does not close this one.
 */
export function isInsideNewerPopover(seq: number, otherSeq: number | null): boolean {
  return otherSeq !== null && otherSeq > seq;
}
```

- [ ] **Step 4: Tokens**

In `src/admin/ui/tokens.ts` replace

```ts
/** Square corners. sm is the default everywhere, md is for windows and modals. No pill radius. */
export const radius = {
  none: '0',
  sm: '4px',
  md: '6px',
} as const;
```

with

```ts
/**
 * Square corners. sm is the default everywhere, md is for windows, modals and
 * the selected style E. lg (8px) only for rich dropdowns (BottomSheet on
 * desktop), sheet only for the phone BottomSheet's top corners, handle only
 * for its grab handle (DECISIONS 2026-10-06 bottom-sheet-v1/v2). No pill radius.
 */
export const radius = {
  none: '0',
  sm: '4px',
  md: '6px',
  lg: '8px',
  sheet: '10px 10px 0 0',
  handle: '2px',
} as const;
```

and in `zIndex` replace

```ts
export const zIndex = {
  drawer: 100100,
  modal: 100200,
```

with

```ts
export const zIndex = {
  drawer: 100100,
  /** Phone BottomSheet: above a Drawer, under a Modal / ConfirmDialog opened from it and under a Popover (Select lists). */
  sheet: 100150,
  modal: 100200,
```

`tokensCss` already turns every `radius` and `zIndex` key into `--ui-radius-*` / `--ui-z-*`.

- [ ] **Step 5: Let the checker accept the new radius tokens**

In `scripts/admin-ui-check.mjs` replace

```js
 *     0 / none / inherit are allowed, and the save bar's own
 *     var(--ui-radius-savebar[-sheet|-dot]) (the approved exception).
```

with

```js
 *     0 / none / inherit are allowed, and the save bar's own
 *     var(--ui-radius-savebar[-sheet|-dot]) (the approved exception);
 *     phase 3 adds lg / sheet / handle / radio (BottomSheet, dropdowns, Radio).
```

and the line

```js
const RADIUS_OK = /^\s*(?:0(?:px)?|none|inherit|var\(--ui-radius-(?:none|sm|md|savebar(?:-sheet|-dot)?)\))\s*(?:!important)?\s*$/;
```

with

```js
const RADIUS_OK = /^\s*(?:0(?:px)?|none|inherit|var\(--ui-radius-(?:none|sm|md|lg|sheet|handle|radio|savebar(?:-sheet|-dot)?)\))\s*(?:!important)?\s*$/;
```

(`radio` is used from Task 5 on; listing it now keeps the checker edit in one place.)

- [ ] **Step 6: Icons**

In `src/admin/ui/icons.tsx`, after the `IconChevronUp` line, add:

```tsx

export const IconChevronLeft = ({ size = 14 }: P) => svg(size, <path d="M8.5 3.5L5 7l3.5 3.5" stroke="currentColor" strokeWidth="1.6" />);

export const IconChevronRight = ({ size = 14 }: P) => svg(size, <path d="M5.5 3.5L9 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" />);

export const IconCheck = ({ size = 14 }: P) => svg(size, <path d="M3 7.5l2.6 2.6L11 4.5" stroke="currentColor" strokeWidth="1.6" />);
```

- [ ] **Step 7: Media query hook**

`src/admin/ui/useMediaQuery.ts`:

```ts
import * as React from 'react';

/** Phone layout of the admin: the breakpoint Drawer, Toast and MobileNav already use. */
export const PHONE_QUERY = '(max-width: 640px)';

const media = (query: string): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;

/** True while the media query matches: right on the first render, updated on every change. */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mq = media(query);
      mq?.addEventListener('change', onChange);
      return () => mq?.removeEventListener('change', onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(subscribe, () => media(query)?.matches ?? false, () => false);
}

/** True on phones (<= 640px). BottomSheet and FilterPanel switch layout on it. */
export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
```

- [ ] **Step 8: Popover with arrow and nesting**

Replace the whole of `src/admin/ui/Popover.tsx` with (same props and behaviour as before, plus `arrow`, nesting, and the old body split into `computePos`, `usePlacement`, `useDismiss`):

```tsx
import * as React from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { arrowOffset, isInsideNewerPopover, isNewestPopover } from '../../club/ui-popover';

/**
 * Floating layer anchored to an element, portalled to <body> so no
 * overflow:hidden / clip parent (windows, cards, modals) can cut it off.
 * Fixed position, follows scroll and resize, flips above the anchor when
 * there is no room below. Used by Select, TimeInput, SearchableSelect,
 * TagsInput, HelpTip and the desktop BottomSheet.
 *
 * Nested popovers (a Select list opened inside a filter dropdown or inside
 * "Alte filtre"): a pointer down in the newer one does not close the older
 * one, and Escape closes only the newest one.
 *
 * The portal root carries `.ui-root`, so the component classes and theme
 * tokens apply outside any AdminPage.
 */

export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export interface PopoverProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Called on a pointer down outside anchor and popover, and on Escape. */
  onClose?: () => void;
  children: React.ReactNode;
  placement?: PopoverPlacement;
  /** Gap to the anchor in px. Default 4. */
  offset?: number;
  /** Popover at least as wide as the anchor (lists under an input). */
  matchWidth?: boolean;
  /** Arrow pointing at the anchor's centre (the desktop BottomSheet dropdown). */
  arrow?: boolean;
  className?: string;
  id?: string;
  role?: string;
  /** Extra props on the popover element (mouse handlers, aria). */
  popoverProps?: React.HTMLAttributes<HTMLDivElement>;
  popoverRef?: React.Ref<HTMLDivElement>;
}

interface Pos {
  top: number;
  left: number;
  minWidth?: number;
  ready: boolean;
  side: 'top' | 'bottom';
  arrowX: number;
}

const HIDDEN: Pos = { top: -9999, left: -9999, ready: false, side: 'bottom', arrowX: 0 };

/** Open popovers by opening order, oldest first. */
const openPopovers: number[] = [];
let lastSeq = 0;

function assignRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as React.MutableRefObject<T>).current = value;
}

/** Sequence number of the popover that contains `target`, or null. */
function popoverSeqOf(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const seq = target.closest<HTMLElement>('.ui-pop')?.dataset.popSeq;
  return seq ? Number(seq) : null;
}

/** Where the popover goes for this anchor; flips above when there is no room below. */
function computePos(a: DOMRect, w: number, h: number, placement: PopoverPlacement, offset: number, matchWidth: boolean): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = placement.startsWith('top');
  if (!top && a.bottom + offset + h > vh && a.top - offset - h > 0) top = true;
  else if (top && a.top - offset - h < 0 && a.bottom + offset + h < vh) top = false;
  const wanted = placement.endsWith('end') ? a.right - w : a.left;
  const left = Math.max(8, Math.min(wanted, vw - w - 8));
  return {
    top: top ? a.top - offset - h : a.bottom + offset,
    left,
    minWidth: matchWidth ? a.width : undefined,
    ready: true,
    side: top ? 'top' : 'bottom',
    arrowX: arrowOffset(a.left, a.width, left, w),
  };
}

type Placement = Pick<PopoverProps, 'anchorRef' | 'placement' | 'offset' | 'matchWidth'>;

/** Position of an open popover, kept in place on scroll, resize and size changes. */
function usePlacement(open: boolean, ref: React.RefObject<HTMLDivElement | null>, opts: Required<Placement>): Pos {
  const { anchorRef, placement, offset, matchWidth } = opts;
  const [pos, setPos] = React.useState<Pos>(HIDDEN);
  const place = React.useCallback(() => {
    const a = anchorRef.current;
    const p = ref.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    setPos(computePos(r, Math.max(p.offsetWidth, matchWidth ? r.width : 0), p.offsetHeight, placement, offset, matchWidth));
  }, [anchorRef, ref, placement, offset, matchWidth]);
  React.useLayoutEffect(() => {
    if (!open) {
      setPos((p) => (p.ready ? HIDDEN : p));
      return undefined;
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    const ro = typeof ResizeObserver !== 'undefined' && ref.current ? new ResizeObserver(place) : undefined;
    if (ro && ref.current) ro.observe(ref.current);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      ro?.disconnect();
    };
  }, [open, place, ref]);
  return pos;
}

/** Outside pointer down and Escape call onClose; nested popovers keep their parents open. */
function useDismiss(open: boolean, ref: React.RefObject<HTMLDivElement | null>, anchorRef: PopoverProps['anchorRef'], onClose?: () => void) {
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  React.useEffect(() => {
    if (!open) return undefined;
    const seq = ++lastSeq;
    openPopovers.push(seq);
    if (ref.current) ref.current.dataset.popSeq = String(seq);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || ref.current?.contains(t)) return;
      if (!isInsideNewerPopover(seq, popoverSeqOf(e.target))) closeRef.current?.();
    };
    const onKey = (e: KeyboardEvent) => {
      // Keep an enclosing Modal, Drawer, BottomSheet or older popover open: only the newest popover closes.
      if (e.key !== 'Escape' || !closeRef.current || !isNewestPopover(openPopovers, seq)) return;
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      openPopovers.splice(openPopovers.indexOf(seq), 1);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, ref, anchorRef]);
}

export function Popover({
  open,
  anchorRef,
  onClose,
  children,
  placement = 'bottom-start',
  offset = 4,
  matchWidth = false,
  arrow = false,
  className,
  id,
  role,
  popoverProps,
  popoverRef,
}: PopoverProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const pos = usePlacement(open, ref, { anchorRef, placement, offset, matchWidth });
  useDismiss(open, ref, anchorRef, onClose);
  if (!open || typeof document === 'undefined') return null;
  const arrowVar = arrow ? ({ '--ui-pop-arrow-x': `${pos.arrowX}px` } as React.CSSProperties) : undefined;
  return createPortal(
    <div
      {...popoverProps}
      ref={(el) => {
        ref.current = el;
        assignRef(popoverRef, el);
      }}
      id={id}
      role={role}
      data-arrow={arrow || undefined}
      data-side={pos.side}
      className={cx('ui-root', 'ui-pop', className)}
      style={{
        top: pos.top,
        left: pos.left,
        minWidth: pos.minWidth,
        visibility: pos.ready ? 'visible' : 'hidden',
        ...arrowVar,
        ...popoverProps?.style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export default Popover;
```

In `src/admin/ui/styles.ts`, after the line

```ts
.ui-root.ui-pop.ui-list{max-height:280px;overflow-y:auto;padding:4px;display:flex;flex-direction:column;gap:1px}
```

add

```ts
.ui-root.ui-pop[data-arrow]::before{content:"";position:absolute;left:calc(var(--ui-pop-arrow-x,20px) - 6px);top:-7px;width:12px;height:12px;background:var(--theme-surface);border-left:1px solid var(--theme-border);border-top:1px solid var(--theme-border);transform:rotate(45deg)}
.ui-root.ui-pop[data-arrow][data-side="top"]::before{top:auto;bottom:-7px;transform:rotate(225deg)}
```

In `src/admin/ui/index.ts` replace

```ts
export { Popover, type PopoverProps, type PopoverPlacement } from './Popover';
```

with

```ts
export { Popover, type PopoverProps, type PopoverPlacement } from './Popover';
export { useMediaQuery, useIsPhone, PHONE_QUERY } from './useMediaQuery';
```

- [ ] **Step 9: Run the checks**

Run: `npx vitest run src/club/__tests__/ui-popover.test.ts` (PASS, 6 tests), `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors), `node scripts/admin-ui-check.mjs --strict` (exit 0, "all 0").

- [ ] **Step 10: Commit**

```bash
git add src/club/ui-popover.ts src/club/__tests__/ui-popover.test.ts src/admin/ui/useMediaQuery.ts src/admin/ui/Popover.tsx src/admin/ui/tokens.ts src/admin/ui/icons.tsx src/admin/ui/styles.ts src/admin/ui/index.ts scripts/admin-ui-check.mjs
git commit -m "feat(admin-ui): sheet tokens, media query hook, popover arrow and nested popovers"
```

---

### Task 2: Custom Select, admin-wide

**Files:**
- Create: `src/club/ui-select.ts`
- Modify: `src/admin/ui/Select.tsx` (whole file), `src/admin/ui/styles.ts` (before `/* segmented control */`, about line 452)
- Test: `src/club/__tests__/ui-select.test.ts`

**Interfaces:**
- Consumes: Task 1 `Popover`, `IconCheck`; `useFieldControl`, `FieldAria` (Field.tsx); `IconChevronDown`.
- Produces: `foldText(s: string): string`, `stepIndex`, `edgeIndex`, `typeaheadIndex(items, from, typed): number`, `selectKeyAction(key, open, items, active): SelectKeyAction`, `scrollTopFor(top, height, scrollTop, viewHeight): number`; `Select` with the same call shape as today (`value`, `onChange(value)`, `options`, `placeholder`, `disabled`, `className`, `style`, `aria-label`, Field aria) but rendered as `<button role="combobox" class="ui-input ui-sel">` plus a `role="listbox"` Popover. Removed from the old API (no call site uses them): `children` `<option>`s, the second `onChange` argument (the change event), other native `<select>` attributes; the ref is now an `HTMLButtonElement`. `onChange` fires only for a different value.

The decided look (open-questions-v2 Q8, "Propus"): the field with a chevron at the right, the list under it, the selected option ticked and in the primary colour. The button keeps `ui-input`, so every page rule that sizes `.ui-input` (toolbars `width:auto`, the status colours through `style`, `.cal-catsel` padding) still applies. All labels sit stacked in one grid cell, so the button is as wide as the longest option, like a native select.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/ui-select.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { edgeIndex, foldText, scrollTopFor, selectKeyAction, stepIndex, typeaheadIndex } from '../ui-select';

const rows = [
  { label: 'Primii Pași' },
  { label: 'Începători' },
  { label: 'Intermediari Bronze' },
  { label: 'Intermediari Silver', disabled: true },
  { label: 'Avansați Gold' },
];

describe('foldText', () => {
  it('drops case and diacritics, comma-below and cedilla forms alike', () => {
    expect(foldText('Școala Ștefan Țepeș')).toBe('scoala stefan tepes');
    expect(foldText('Şcoala')).toBe('scoala');
    expect(foldText('Începători')).toBe('incepatori');
  });
});

describe('stepIndex and edgeIndex', () => {
  it('moves to the next enabled option and stops at the ends', () => {
    expect(stepIndex(rows, 2, 1)).toBe(4);
    expect(stepIndex(rows, 4, 1)).toBe(4);
    expect(stepIndex(rows, 0, -1)).toBe(0);
    expect(stepIndex(rows, -1, 1)).toBe(0);
  });

  it('finds the first and the last enabled option', () => {
    expect(edgeIndex(rows, 'first')).toBe(0);
    expect(edgeIndex([{ label: 'a', disabled: true }, { label: 'b' }], 'first')).toBe(1);
    expect(edgeIndex(rows, 'last')).toBe(4);
    expect(edgeIndex([], 'first')).toBe(-1);
  });
});

describe('typeaheadIndex', () => {
  it('ignores case and diacritics', () => {
    expect(typeaheadIndex(rows, -1, 'i')).toBe(1);
    expect(typeaheadIndex(rows, -1, 'av')).toBe(4);
    expect(typeaheadIndex([{ label: 'Club' }, { label: 'Școala de patinaj' }], 0, 's')).toBe(1);
  });

  it('the same letter again cycles through the matches, skipping disabled options', () => {
    expect(typeaheadIndex(rows, 1, 'ii')).toBe(2);
    expect(typeaheadIndex(rows, 2, 'iii')).toBe(1);
  });

  it('a longer word keeps the current option while it still fits', () => {
    expect(typeaheadIndex(rows, 2, 'inter')).toBe(2);
  });

  it('returns -1 when nothing matches', () => {
    expect(typeaheadIndex(rows, 0, 'z')).toBe(-1);
    expect(typeaheadIndex(rows, 0, '')).toBe(-1);
    expect(typeaheadIndex([], 0, 'a')).toBe(-1);
  });
});

describe('selectKeyAction', () => {
  it('opens on ArrowDown, ArrowUp, Enter and Space, on the selected option', () => {
    expect(selectKeyAction('ArrowDown', false, rows, 2)).toEqual({ type: 'open', index: 2 });
    expect(selectKeyAction(' ', false, rows, -1)).toEqual({ type: 'open', index: 0 });
    expect(selectKeyAction('a', false, rows, 2)).toEqual({ type: 'none' });
    expect(selectKeyAction('Escape', false, rows, 2)).toEqual({ type: 'none' });
  });

  it('moves, picks and closes while open', () => {
    expect(selectKeyAction('ArrowDown', true, rows, 2)).toEqual({ type: 'move', index: 4 });
    expect(selectKeyAction('ArrowUp', true, rows, 4)).toEqual({ type: 'move', index: 2 });
    expect(selectKeyAction('Home', true, rows, 4)).toEqual({ type: 'move', index: 0 });
    expect(selectKeyAction('End', true, rows, 0)).toEqual({ type: 'move', index: 4 });
    expect(selectKeyAction('Enter', true, rows, 1)).toEqual({ type: 'pick', index: 1 });
    expect(selectKeyAction(' ', true, rows, 1)).toEqual({ type: 'pick', index: 1 });
    expect(selectKeyAction('Enter', true, rows, -1)).toEqual({ type: 'close' });
    expect(selectKeyAction('Escape', true, rows, 1)).toEqual({ type: 'close' });
    expect(selectKeyAction('Tab', true, rows, 1)).toEqual({ type: 'close' });
  });
});

describe('scrollTopFor', () => {
  it('scrolls only as far as needed to show the highlighted option', () => {
    expect(scrollTopFor(0, 30, 60, 280)).toBe(0);
    expect(scrollTopFor(300, 30, 0, 280)).toBe(50);
    expect(scrollTopFor(100, 30, 0, 280)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/__tests__/ui-select.test.ts`
Expected: FAIL (`Failed to resolve import "../ui-select"`).

- [ ] **Step 3: The keyboard and list rules**

`src/club/ui-select.ts`:

```ts
/**
 * Keyboard and list rules of the admin custom Select (src/admin/ui/Select.tsx)
 * and the option groups of SearchableSelect. Pure: no DOM, no React.
 */

export interface ListItem {
  label: string;
  disabled?: boolean;
}

/** Lower case, diacritics removed ("Școala" -> "scoala", "Începători" -> "incepatori"). */
export function foldText(s: string): string {
  return s
    .toLocaleLowerCase('ro')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Next enabled option from `from` in direction `dir`; stops at the ends like a native select. -1 when none is enabled. */
export function stepIndex(items: readonly ListItem[], from: number, dir: 1 | -1): number {
  for (let i = from + dir; i >= 0 && i < items.length; i += dir) {
    if (!items[i].disabled) return i;
  }
  return from >= 0 && from < items.length && !items[from].disabled ? from : -1;
}

/** First or last enabled option, -1 when none. */
export function edgeIndex(items: readonly ListItem[], edge: 'first' | 'last'): number {
  return edge === 'first' ? stepIndex(items, -1, 1) : stepIndex(items, items.length, -1);
}

/**
 * Option for the letters typed so far: the first enabled option after `from`
 * whose label starts with them (case and diacritics ignored), wrapping around.
 * The same letter typed again cycles through the options starting with it;
 * a longer word keeps the current option while it still fits. -1 when none.
 */
export function typeaheadIndex(items: readonly ListItem[], from: number, typed: string): number {
  const q = foldText(typed);
  if (!q || items.length === 0) return -1;
  const repeated = q.length > 1 && [...q].every((c) => c === q[0]);
  const needle = repeated ? q[0] : q;
  const start = Math.max(0, repeated || q.length === 1 ? from + 1 : from);
  for (let k = 0; k < items.length; k++) {
    const item = items[(start + k) % items.length];
    if (!item.disabled && foldText(item.label).startsWith(needle)) return (start + k) % items.length;
  }
  return -1;
}

export type SelectKeyAction =
  | { type: 'open'; index: number }
  | { type: 'move'; index: number }
  | { type: 'pick'; index: number }
  | { type: 'close' }
  | { type: 'none' };

const OPEN_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' ']);

const MOVES: Record<string, (items: readonly ListItem[], active: number) => number> = {
  ArrowDown: (items, active) => stepIndex(items, active, 1),
  ArrowUp: (items, active) => stepIndex(items, active, -1),
  Home: (items) => edgeIndex(items, 'first'),
  End: (items) => edgeIndex(items, 'last'),
};

/**
 * What a key does on the Select button (select-only combobox). `active` is
 * the highlighted option while open, else the selected one (-1 when none).
 */
export function selectKeyAction(key: string, open: boolean, items: readonly ListItem[], active: number): SelectKeyAction {
  if (!open) {
    if (!OPEN_KEYS.has(key)) return { type: 'none' };
    return { type: 'open', index: active >= 0 ? active : edgeIndex(items, 'first') };
  }
  const move = MOVES[key];
  if (move) return { type: 'move', index: move(items, active) };
  if (key === 'Enter' || key === ' ') return active >= 0 ? { type: 'pick', index: active } : { type: 'close' };
  return key === 'Escape' || key === 'Tab' ? { type: 'close' } : { type: 'none' };
}

/** New scrollTop of a list so the item at [top, top + height) shows; unchanged when it already does. */
export function scrollTopFor(top: number, height: number, scrollTop: number, viewHeight: number): number {
  if (top < scrollTop) return top;
  if (top + height > scrollTop + viewHeight) return top + height - viewHeight;
  return scrollTop;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/club/__tests__/ui-select.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: The component**

Replace the whole of `src/admin/ui/Select.tsx` with:

```tsx
import * as React from 'react';
import { cx } from './cx';
import { useFieldControl, type FieldAria } from './Field';
import { Popover } from './Popover';
import { IconCheck, IconChevronDown } from './icons';
import { edgeIndex, scrollTopFor, selectKeyAction, typeaheadIndex } from '../../club/ui-select';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends FieldAria {
  value: string;
  onChange?: (value: string) => void;
  options?: SelectOption[];
  /** Adds a first option with this text and the value '' (picking it clears the choice). */
  placeholder?: string;
  disabled?: boolean;
  /** On the button (it also carries `ui-input`). */
  className?: string;
  /** On the button, e.g. the status colours of the Înscrieri status select. */
  style?: React.CSSProperties;
  'aria-label'?: string;
}

/** Pause after which typed letters start a new search (ms). */
const TYPEAHEAD_MS = 500;

const rowsOf = (options: SelectOption[] | undefined, placeholder: string | undefined): SelectOption[] =>
  placeholder === undefined ? (options ?? []) : [{ value: '', label: placeholder }, ...(options ?? [])];

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

interface ListState {
  open: boolean;
  active: number;
  selected: number;
  setActive: (i: number) => void;
  show: (i: number) => void;
  close: () => void;
  choose: (i: number) => void;
  typeahead: (ch: string) => void;
}

/** Letters typed within TYPEAHEAD_MS of each other search together. */
function useTypeahead(rows: SelectOption[], from: number, onMatch: (i: number) => void): (ch: string) => void {
  const typed = React.useRef({ text: '', at: 0 });
  return (ch: string) => {
    const now = Date.now();
    const text = (now - typed.current.at < TYPEAHEAD_MS ? typed.current.text : '') + ch;
    typed.current = { text, at: now };
    const i = typeaheadIndex(rows, from, text);
    if (i >= 0) onMatch(i);
  };
}

/** Open state, highlighted row and type-ahead of one Select. */
function useListState(rows: SelectOption[], value: string, pick: (v: string) => void): ListState {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const selected = rows.findIndex((r) => r.value === value);
  const close = () => setOpen(false);
  const show = (i: number) => {
    setActive(i);
    setOpen(true);
  };
  const choose = (i: number) => {
    const row = rows[i];
    if (!row || row.disabled) return;
    pick(row.value);
    close();
  };
  const typeahead = useTypeahead(rows, open ? active : selected, (i) => (open ? setActive(i) : pick(rows[i].value)));
  return { open, active, selected, setActive, show, close, choose, typeahead };
}

/** Keys on the button: open, move, pick, close; other printable keys search. */
function keyHandler(list: ListState, rows: SelectOption[]) {
  return (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const act = selectKeyAction(e.key, list.open, rows, list.open ? list.active : list.selected);
    if (act.type === 'none') {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) list.typeahead(e.key);
      return;
    }
    if (e.key !== 'Tab') e.preventDefault();
    if (act.type === 'open') list.show(act.index);
    else if (act.type === 'move') list.setActive(act.index);
    else if (act.type === 'pick') list.choose(act.index);
    else list.close();
  };
}

interface TriggerProps extends FieldAria {
  rows: SelectOption[];
  selected: number;
  open: boolean;
  active: number;
  listId: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  onToggle: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

/** The button: every label stacked in one grid cell, so it is as wide as the longest one (like a native select). */
const SelectTrigger = React.forwardRef<HTMLButtonElement, TriggerProps>(function SelectTrigger(
  { rows, selected, open, active, listId, disabled, className, style, required, onToggle, onKeyDown, ...aria },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      aria-required={required || undefined}
      {...aria}
      disabled={disabled}
      className={cx('ui-input', 'ui-sel', className)}
      style={style}
      onClick={onToggle}
      onKeyDown={onKeyDown}
    >
      <span className="ui-sel-val">
        {rows.map((r, i) => (
          <span key={`${i}-${r.value}`} data-on={i === selected || undefined}>
            {r.label}
          </span>
        ))}
        {selected < 0 && <span data-on>{' '}</span>}
      </span>
      <span className="ui-sel-chev" aria-hidden="true">
        <IconChevronDown size={12} />
      </span>
    </button>
  );
});

interface ListProps {
  rows: SelectOption[];
  value: string;
  list: ListState;
  listId: string;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  disabled?: boolean;
}

/** The open list: the shared Popover + ui-opt rows, the selected option ticked. */
function SelectList({ rows, value, list, listId, anchorRef, disabled }: ListProps) {
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const box = boxRef.current;
    const el = list.open && list.active >= 0 ? document.getElementById(`${listId}-${list.active}`) : null;
    if (box && el) box.scrollTop = scrollTopFor(el.offsetTop, el.offsetHeight, box.scrollTop, box.clientHeight);
  }, [list.open, list.active, listId]);
  return (
    <Popover
      open={list.open && !disabled}
      anchorRef={anchorRef}
      onClose={list.close}
      matchWidth
      className="ui-list ui-sel-list"
      id={listId}
      role="listbox"
      popoverRef={boxRef}
      popoverProps={{ onMouseDown: (e) => e.preventDefault() }}
    >
      {rows.map((r, i) => (
        <div
          key={`${i}-${r.value}`}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={r.value === value}
          aria-disabled={r.disabled || undefined}
          className="ui-opt ui-sel-opt"
          data-active={i === list.active || undefined}
          onMouseEnter={() => list.setActive(i)}
          onClick={() => list.choose(i)}
        >
          <span className="ui-sel-tick" aria-hidden="true">
            {r.value === value && <IconCheck size={12} />}
          </span>
          <span>{r.label}</span>
        </div>
      ))}
    </Popover>
  );
}

/**
 * Admin-wide select (DECISIONS 2026-10-06 open-questions-v2 Q8): a button with
 * a chevron that opens the shared list, the selected option ticked. Keyboard
 * as a select-only combobox: ArrowDown / ArrowUp / Enter / Space open, then
 * move and pick; Home / End; Escape and Tab close; typed letters jump to an
 * option (diacritics ignored), also while closed. Focus stays on the button,
 * so Modal / Drawer / BottomSheet focus traps keep working. Inside a Field it
 * picks up id, aria and required. onChange fires only for a different value.
 */
export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { value, onChange, options, placeholder, disabled, className, style, ...rest },
  ref,
) {
  const field = useFieldControl(rest);
  const rows = rowsOf(options, placeholder);
  const list = useListState(rows, value, (v) => v !== value && onChange?.(v));
  const anchorRef = React.useRef<HTMLButtonElement | null>(null);
  const listId = React.useId().replace(/:/g, '');
  const toggle = () => (list.open ? list.close() : list.show(list.selected >= 0 ? list.selected : edgeIndex(rows, 'first')));
  const setRefs = (el: HTMLButtonElement | null) => {
    anchorRef.current = el;
    assignRef(ref, el);
  };
  return (
    <>
      <SelectTrigger
        {...field}
        ref={setRefs}
        rows={rows}
        selected={list.selected}
        open={list.open}
        active={list.active}
        listId={listId}
        disabled={disabled}
        className={className}
        style={style}
        onToggle={toggle}
        onKeyDown={keyHandler(list, rows)}
      />
      <SelectList rows={rows} value={value} list={list} listId={listId} anchorRef={anchorRef} disabled={disabled} />
    </>
  );
});

export default Select;
```

(Needs decision 5, option B: on phones render the rows in a `BottomSheet` (Task 7) titled by the field's `aria-label` instead of the Popover; `useListState` and `keyHandler` stay as they are.)

In `src/admin/ui/styles.ts`, immediately before the line `/* segmented control */`, add:

```ts
/* select (custom, admin-wide): a combobox button + the shared list */
${R} .ui-sel{display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;cursor:pointer;padding-right:8px}
${R} .ui-sel:disabled{cursor:not-allowed}
${R} .ui-sel[aria-expanded="true"]{border-color:var(--theme-primary);box-shadow:0 0 0 1px var(--theme-primary)}
${R} .ui-sel-val{display:grid;flex:1;min-width:0}
${R} .ui-sel-val > span{grid-area:1 / 1;visibility:hidden;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${R} .ui-sel-val > span[data-on]{visibility:visible}
${R} .ui-sel-chev{display:inline-flex;flex-shrink:0;color:var(--theme-text-muted);transition:transform var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-sel[aria-expanded="true"] .ui-sel-chev{transform:rotate(180deg)}
${R} .ui-sel-opt{flex-direction:row;align-items:center;gap:8px}
${R} .ui-sel-opt[aria-selected="true"]{color:var(--theme-primary)}
${R} .ui-sel-tick{display:inline-flex;width:12px;flex-shrink:0}
@media (prefers-reduced-motion:reduce){${R} .ui-sel-chev{transition:none}}

```

- [ ] **Step 6: Run the checks**

Run: `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors: every one of the 36 call sites compiles against the new props unchanged), `node scripts/admin-ui-check.mjs --strict` (exit 0).

- [ ] **Step 7: Commit**

```bash
git add src/club/ui-select.ts src/club/__tests__/ui-select.test.ts src/admin/ui/Select.tsx src/admin/ui/styles.ts
git commit -m "feat(admin-ui): custom Select with chevron, shared list and type-ahead"
```

---

### Task 3: Every Select call site on the custom Select

**Files:**
- Modify: `src/admin/ui/styles.ts:141`, `src/admin/dashboard/inboxShared.tsx:61`, `src/admin/dashboard/SubmissionTable.tsx:171,346,1250` (comments)
- Test: `src/club/__tests__/admin-select-migration.test.ts`

**Interfaces:**
- Consumes: Task 2 `Select`.
- Produces: no native `<select>` and no `select.ui-input` rule left in `src/admin` or `src/plugins`.

The props did not change, so every page switched with Task 2. This task removes what still targets the native element and checks each call site. The 36 call sites (17 files), with what they rely on:

| File:line | Use | Relies on | Change |
|---|---|---|---|
| `src/admin/dashboard/CompetitiiPage.tsx:407,414` | season / athlete filters, `placeholder` | `.ui-grid2` width | none |
| `src/admin/dashboard/FormEditorPage.tsx:412,612,630` | question type, display mode, icon (in Field) | Field id | none |
| `src/admin/dashboard/FormResultsPage.tsx:351` | "Ordine" | toolbar | none |
| `src/admin/dashboard/FormResultsPage.tsx:399` | "Stare" in Field | `.inbx-form .ui-field select.ui-input` width | rule moves to `.ui-sel` (Step 3) |
| `src/admin/dashboard/MembriEchipaPage.tsx:601` | category filter, `placeholder` | `.ui-table-bar` | none |
| `src/admin/dashboard/MesajePage.tsx:399,406` | "Motiv" (`placeholder`), "Ordine" | toolbar | none |
| `src/admin/dashboard/SheetsDialog.tsx:543` | check interval, `disabled`, inside a Modal | `.sdlg-sched .ui-input` | none |
| `src/admin/dashboard/SportivEditPage.tsx:870` | program type in a RepeatableList row | Field id | none (moves to Profil public with the Sportivi plan) |
| `src/admin/dashboard/SportiviPage.tsx:274,281` | discipline / visibility filters | DataTable toolbar | none (page replaced by the Sportivi plan) |
| `src/admin/dashboard/SubmissionTable.tsx:380` | `SeasonSelect`: `style`, `disabled`, `placeholder` | panel width | comment only |
| `src/admin/dashboard/SubmissionTable.tsx:1255` | status select, tinted through `style`, `sbt-status-sel` / `sbt-cell-sel` (spreadsheet cell) | `.ui-input.sbt-*` rules | comment only |
| `src/admin/dashboard/SubmissionTable.tsx:1415` | season bar | `.sbt-season .ui-input{width:auto}` | none |
| `src/admin/dashboard/SubmissionTable.tsx:1593,1603,1618` | "Alte filtre" builder: column, operator (`disabled`), value, inside a Popover | `.sbt-advpop .ui-input{width:auto}`; nested popovers (Task 1) | none |
| `src/admin/dashboard/SubmissionTable.tsx:1836,1890` | sort, rows per page | `.sbt-tbB`, `.sbt-ft-l .ui-input` | none |
| `src/admin/dashboard/UiReferencePage.tsx:378,388,968` | reference demos, theme preview (`style` width auto) | | none |
| `src/admin/dashboard/inscrieri/EditableAnswer.tsx:19,38` | Calitate, Membru A.C.S. in the panel | Field | none (the Înscrieri plan replaces this file with Editează) |
| `src/admin/pages/RegulamentPage.tsx:238` | category icon, `placeholder` | Field | none |
| `src/admin/pages/preturi/NewListDrawer.tsx:50` | section, in a Drawer | Field | none |
| `src/admin/pages/preturi/PriceItemDrawer.tsx:32` | item kind, in a Drawer | Field | none |
| `src/admin/pages/sezoane/SeasonDrawer.tsx:17,20` | start and end month, in a Drawer | Field | none |
| `src/admin/ui/ObjectFieldCard.tsx:116` | `type: 'select'` fields (also in content-manager fields) | `.ui-root` on the card | none |
| `src/plugins/component-preview/admin/src/calendar/EventDrawer.tsx:195,252,399` | category (colour swatch), week of month, day state (`cal-dt-state`), in a Drawer | `.cal-catsel .ui-input{padding-left:28px}`, `.cal-dt-state` | none |

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-select-migration.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const SRC = join(__dirname, '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : sources(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

it('no native <select> is left in the admin: every page uses the custom Select', () => {
  const files = [...sources(join(SRC, 'admin')), ...sources(join(SRC, 'plugins'))];
  const hits = files.filter((f) => /<select[\s>]|select\.ui-input/.test(readFileSync(f, 'utf8'))).map((f) => relative(SRC, f));
  expect(hits).toEqual([]);
});

it('the Select is a combobox button with the shared list', () => {
  const select = readFileSync(join(SRC, 'admin', 'ui', 'Select.tsx'), 'utf8');
  expect(select).toContain('role="combobox"');
  expect(select).toContain('role="listbox"');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/__tests__/admin-select-migration.test.ts`
Expected: FAIL; the first test lists `admin/dashboard/SubmissionTable.tsx` (comments with `<select>`), `admin/dashboard/inboxShared.tsx` and `admin/ui/styles.ts` (`select.ui-input`).

- [ ] **Step 3: Remove what targets the native element**

In `src/admin/ui/styles.ts` delete the line

```ts
${R} select.ui-input{padding-right:6px}
```

In `src/admin/dashboard/inboxShared.tsx` replace

```ts
.ui-root .inbx-form .ui-field select.ui-input{width:auto;min-width:200px}
```

with

```ts
.ui-root .inbx-form .ui-field .ui-sel{width:auto;min-width:200px}
```

In `src/admin/dashboard/SubmissionTable.tsx` replace the three comments:
- `  /** Season <select> for the detail panel; null when the screen has no seasons. */` -> `  /** Season Select for the detail panel; null when the screen has no seasons. */`
- ` * Season picker. A real <select> everywhere a season is chosen — a free-text` -> ` * Season picker. A Select with fixed options everywhere a season is chosen — a free-text`
- `  /** Status <select> tinted with the status colours (panel and spreadsheet cell). */` -> `  /** Status Select tinted with the status colours (panel and spreadsheet cell). */`

- [ ] **Step 4: Run the checks**

Run: `npx vitest run src/club/__tests__/admin-select-migration.test.ts` (PASS, 2 tests), `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors), `node scripts/admin-ui-check.mjs --strict` (exit 0). Every row of the table is seen in a browser in Task 12.

- [ ] **Step 5: Commit**

```bash
git add src/club/__tests__/admin-select-migration.test.ts src/admin/ui/styles.ts src/admin/dashboard/inboxShared.tsx src/admin/dashboard/SubmissionTable.tsx
git commit -m "refactor(admin): every Select call site on the custom Select, native select rules gone"
```

---

### Task 4: Option groups in SearchableSelect (group pickers)

**Files:**
- Modify: `src/club/ui-select.ts` (append), `src/admin/ui/SearchableSelect.tsx` (imports, `ComboOption`, the option list), `src/admin/ui/styles.ts` (after `.ui-list-note`, about line 411)
- Test: `src/club/__tests__/ui-select.test.ts` (append)

**Interfaces:**
- Consumes: Task 2 `src/club/ui-select.ts`.
- Produces: `groupHeaderAt(list: ReadonlyArray<{ group?: string }>, i: number): string | null`; `ComboOption.group?: string`: options of one group listed together under a header row (`.ui-opt-group`, `role="presentation"`, not selectable, skipped by the arrow keys). Spec 4.3: the group picker lists the school's groups under its section name, then the Club groups.

- [ ] **Step 1: Write the failing test**

Append to `src/club/__tests__/ui-select.test.ts`, and add `groupHeaderAt` to its import from `'../ui-select'`:

```ts
describe('groupHeaderAt', () => {
  it('puts the section name before the first group of each section', () => {
    const list = [{ group: 'Școala de patinaj' }, { group: 'Școala de patinaj' }, { group: 'Club' }, { group: 'Club' }];
    expect(list.map((_, i) => groupHeaderAt(list, i))).toEqual(['Școala de patinaj', null, 'Club', null]);
  });

  it('shows no header for options without a group, nor past the end', () => {
    const list = [{}, { group: 'Club' }, {}];
    expect(list.map((_, i) => groupHeaderAt(list, i))).toEqual([null, 'Club', null]);
    expect(groupHeaderAt(list, 5)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/__tests__/ui-select.test.ts`
Expected: FAIL (`groupHeaderAt is not a function`).

- [ ] **Step 3: The rule**

Append to `src/club/ui-select.ts`:

```ts
/**
 * Group header to show before option `i` of a filtered list (SearchableSelect
 * group pickers: groups under their section name): the option's group when it
 * differs from the previous option's, else null. Options without a group get none.
 */
export function groupHeaderAt(list: ReadonlyArray<{ group?: string }>, i: number): string | null {
  const group = list[i]?.group;
  if (!group) return null;
  return i === 0 || list[i - 1].group !== group ? group : null;
}
```

- [ ] **Step 4: The headers in SearchableSelect**

In `src/admin/ui/SearchableSelect.tsx`, under the icons import add

```tsx
import { groupHeaderAt } from '../../club/ui-select';
```

In `ComboOption` replace

```tsx
  /** Second, muted line (club, year, email). */
  hint?: string;
  disabled?: boolean;
}
```

with

```tsx
  /** Second, muted line (club, year, email). */
  hint?: string;
  disabled?: boolean;
  /**
   * Header the option is listed under (e.g. the section name of a group:
   * "Școala de patinaj", then "Club"). Options of one group must be next to
   * each other; a header shows before the first option of each group.
   */
  group?: string;
}
```

and replace the option list

```tsx
        {shown.map((o, i) => (
          <div
            key={o.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={o.value === value}
            aria-disabled={o.disabled || undefined}
            className="ui-opt"
            data-active={i === active || undefined}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(o)}
          >
            <span>{o.label}</span>
            {o.hint && <span className="ui-opt-hint">{o.hint}</span>}
          </div>
        ))}
```

with

```tsx
        {shown.map((o, i) => (
          <React.Fragment key={o.value}>
            {groupHeaderAt(shown, i) !== null && (
              <div className="ui-opt-group" role="presentation">
                {o.group}
              </div>
            )}
            <div
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              className="ui-opt"
              data-active={i === active || undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
            >
              <span>{o.label}</span>
              {o.hint && <span className="ui-opt-hint">{o.hint}</span>}
            </div>
          </React.Fragment>
        ))}
```

In `src/admin/ui/styles.ts`, after the line starting `${R} .ui-list-note{`, add:

```ts
${R} .ui-opt-group{padding:8px 9px 3px;font-size:var(--ui-fs-label);font-weight:var(--ui-fw-label);letter-spacing:var(--ui-ls-label);text-transform:uppercase;color:var(--theme-text-muted);cursor:default}
${R} .ui-opt-group:not(:first-child){margin-top:4px;border-top:1px solid var(--theme-border-subtle)}
```

(The header uses the admin's existing `.ui-label` type role.)

- [ ] **Step 5: Run the checks**

Run: `npx vitest run src/club/__tests__/ui-select.test.ts` (PASS, 12 tests), `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`.

- [ ] **Step 6: Commit**

```bash
git add src/club/ui-select.ts src/club/__tests__/ui-select.test.ts src/admin/ui/SearchableSelect.tsx src/admin/ui/styles.ts
git commit -m "feat(admin-ui): SearchableSelect options under group headers"
```

---

### Task 5: Radio and RadioGroup (waits for Needs decision 1)

**Files:**
- Create: `src/admin/ui/Radio.tsx`
- Modify: `src/admin/ui/tokens.ts` (radius), `src/admin/ui/styles.ts` (after `.ui-check--disabled`, about line 127), `src/admin/ui/index.ts`
- Test: `src/club/__tests__/admin-radio.test.ts`

**Interfaces:**
- Consumes: Task 1 checker entry `radio`.
- Produces: `Radio` (`RadioProps`), `RadioGroup<V>` (`RadioGroupProps<V>`, `RadioOption<V>`), token `radius.radio` (`--ui-radius-radio`). Native radios: arrow keys move and choose inside the group. `variant="card"` = the prototype v5 choice cards (bordered box, bold label, hint under it, primary border and soft background when chosen), two side by side, stacked on phones (spec 4.8).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-radio.test.ts` (the last assertion holds the decided token: `'50%'` for option A, `'4px'` for option B):

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { radius } from '../../admin/ui/tokens';

// The admin bundle has no test runner; these read its source.
const source = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

it('Radio is a native radio inside a radiogroup, so arrow keys move and choose', () => {
  const radio = source('admin/ui/Radio.tsx');
  expect(radio).toContain('role="radiogroup"');
  expect(radio).toContain('type="radio"');
});

it('the mark uses the radio radius token, with the decided shape', () => {
  expect(source('admin/ui/styles.ts')).toContain('border-radius:var(--ui-radius-radio)');
  expect(radius.radio).toBe('50%');
});

it('choice cards sit side by side and stack on phones', () => {
  const css = source('admin/ui/styles.ts');
  expect(css).toContain('.ui-radios--card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))');
  expect(css).toContain('@media (max-width:640px){${R} .ui-radios--card{grid-template-columns:minmax(0,1fr)}}');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/__tests__/admin-radio.test.ts`
Expected: FAIL (`ENOENT ... admin/ui/Radio.tsx`).

- [ ] **Step 3: The token**

In `src/admin/ui/tokens.ts`, in `radius`, after `handle: '2px',` add (option A; option B: `radio: '4px',`):

```ts
  /** Radio mark (plan 3-1, Needs decision 1). */
  radio: '50%',
```

- [ ] **Step 4: The component**

`src/admin/ui/Radio.tsx`:

```tsx
import * as React from 'react';
import { cx } from './cx';

export interface RadioProps {
  /** Shared by the radios of one group: arrow keys move inside it. */
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
  /** Muted line(s) under the label. */
  hint?: React.ReactNode;
  disabled?: boolean;
  /** Choice card (prototype v5 confirm window): bordered box, bold label, hint under it. */
  card?: boolean;
  className?: string;
}

/** One admin radio (DECISIONS 2026-10-06 open-questions-v2 Q8): a native input with the admin mark. */
export function Radio({ name, value, checked, onChange, label, hint, disabled = false, card = false, className }: RadioProps) {
  return (
    <label
      className={cx('ui-radio', card && 'ui-radio--card', disabled && 'ui-radio--disabled', className)}
      data-checked={checked || undefined}
    >
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} />
      <span className="ui-radio-text">
        <span className="ui-radio-label">{label}</span>
        {hint !== undefined && hint !== null && <span className="ui-radio-hint">{hint}</span>}
      </span>
    </label>
  );
}

export interface RadioOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<V extends string = string> {
  /** null = nothing chosen yet (a "Probabil" match: the admin must choose). */
  value: V | null;
  onChange: (value: V) => void;
  options: RadioOption<V>[];
  /** plain: mark + label. card: choice cards, two side by side, stacked on phones. Default plain. */
  variant?: 'plain' | 'card';
  /** Default 'row'; 'column' stacks the options (cards too). */
  direction?: 'row' | 'column';
  /** Input name; default a generated one. */
  name?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/** A group of admin radios: role radiogroup, one name, arrow keys move and choose. */
export function RadioGroup<V extends string = string>({
  value,
  onChange,
  options,
  variant = 'plain',
  direction = 'row',
  name,
  disabled = false,
  className,
  ...aria
}: RadioGroupProps<V>) {
  const autoName = React.useId();
  return (
    <div role="radiogroup" {...aria} className={cx('ui-radios', `ui-radios--${variant}`, `ui-radios--${direction}`, className)}>
      {options.map((o) => (
        <Radio
          key={o.value}
          name={name ?? autoName}
          value={o.value}
          checked={o.value === value}
          onChange={() => onChange(o.value)}
          label={o.label}
          hint={o.hint}
          disabled={disabled || o.disabled}
          card={variant === 'card'}
        />
      ))}
    </div>
  );
}

export default RadioGroup;
```

In `src/admin/ui/styles.ts`, after the line

```ts
${R} .ui-check--disabled{cursor:default;color:var(--theme-text-disabled)}
```

add

```ts

/* radio (open-questions-v2 Q8); card = the choice cards of the confirm window (prototype v5) */
${R} .ui-radios{display:flex;flex-wrap:wrap;gap:var(--ui-space-2) var(--ui-space-4)}
${R} .ui-radios--column{flex-direction:column;gap:var(--ui-space-2)}
${R} .ui-radios--card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
${R} .ui-radios--card.ui-radios--column{grid-template-columns:minmax(0,1fr)}
@media (max-width:640px){${R} .ui-radios--card{grid-template-columns:minmax(0,1fr)}}
${R} .ui-radio{display:inline-flex;align-items:flex-start;gap:8px;font-size:var(--ui-fs-body);color:var(--theme-text);cursor:pointer;user-select:none}
${R} .ui-radio input{appearance:none;-webkit-appearance:none;margin:2px 0 0;flex-shrink:0;width:16px;height:16px;border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-radio);background:var(--theme-surface);cursor:pointer}
${R} .ui-radio input:checked{border:5px solid var(--theme-primary)}
${R} .ui-radio-text{display:flex;flex-direction:column;gap:2px;min-width:0}
${R} .ui-radio-hint{font-size:var(--ui-fs-body-sm);color:var(--theme-text-muted)}
${R} .ui-radio--card{display:flex;padding:10px 12px;border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);background:var(--theme-surface)}
${R} .ui-radio--card:hover{border-color:var(--theme-border-strong)}
${R} .ui-radio--card[data-checked]{border-color:var(--theme-primary);background:var(--theme-primary-soft);box-shadow:0 0 0 2px var(--theme-primary-soft-line)}
${R} .ui-radio--card .ui-radio-label{font-weight:700}
${R} .ui-radio--disabled{cursor:default;color:var(--theme-text-disabled)}
${R} .ui-radio--disabled input{opacity:.55;cursor:default}
```

In `src/admin/ui/index.ts`, after the Checkbox export line, add:

```ts
export { Radio, RadioGroup, type RadioProps, type RadioGroupProps, type RadioOption } from './Radio';
```

- [ ] **Step 5: Run the checks**

Run: `npx vitest run src/club/__tests__/admin-radio.test.ts` (PASS, 3 tests), `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`.

- [ ] **Step 6: Commit**

```bash
git add src/admin/ui/Radio.tsx src/admin/ui/tokens.ts src/admin/ui/styles.ts src/admin/ui/index.ts src/club/__tests__/admin-radio.test.ts
git commit -m "feat(admin-ui): Radio and RadioGroup with choice cards"
```

---

### Task 6: Toast `action` ("Anulează")

**Files:**
- Modify: `src/admin/ui/Toast.tsx` (`ToastOptions`, `ToastItem`, `push`, `ToastCard`, new `ToastActionButton`), `src/admin/ui/styles.ts` (after `.ui-toast-close`, about line 505), `src/admin/ui/index.ts` (Toast exports)
- Test: `src/club/__tests__/admin-toast-action.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ToastAction { label: string; onClick: () => void }`, `ToastOptions.action?: ToastAction` on every `adminToast.*` call. The 3A undo is `adminToast.success(\`Înscriere confirmată: ${name}\`, { duration: 8000, action: { label: 'Anulează', onClick: undo } })` (spec 4.6).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-toast-action.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const toast = readFileSync(join(__dirname, '..', '..', 'admin', 'ui', 'Toast.tsx'), 'utf8');

it('ToastOptions carries an action with a label and a handler', () => {
  expect(toast).toContain('export interface ToastAction {');
  expect(toast).toContain('action?: ToastAction;');
  expect(toast).toContain('action: opts?.action');
});

it('the action runs once and closes the toast', () => {
  expect(toast).toContain('action.onClick();');
  expect(toast).toContain('disabled={leaving}');
});

it('a toast with an action waits while the pointer or the focus is on it', () => {
  expect(toast).toContain('const pausable = urgent || item.action !== undefined;');
  expect(toast).toContain('onFocus={item.action ? pause : undefined}');
  expect(toast).toContain('onBlur={item.action ? arm : undefined}');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/__tests__/admin-toast-action.test.ts`
Expected: FAIL (3 tests; `export interface ToastAction {` not found).

- [ ] **Step 3: The option**

In `src/admin/ui/Toast.tsx` replace

```tsx
export interface ToastOptions {
  /** Optional bold lead-in, above the message. */
  title?: React.ReactNode;
  /** Overrides the tone's default auto-dismiss delay (ms). danger ignores this and stays until closed. */
  duration?: number;
}
```

with

```tsx
/** One button in a toast, e.g. { label: 'Anulează', onClick: undo }. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Optional bold lead-in, above the message. */
  title?: React.ReactNode;
  /** Overrides the tone's default auto-dismiss delay (ms). danger ignores this and stays until closed. */
  duration?: number;
  /**
   * A button between the text and the close X. Clicking it runs `onClick`
   * once and closes the toast. While a toast has an action, the countdown
   * waits as long as the pointer or the keyboard focus is on the toast.
   */
  action?: ToastAction;
}
```

In `ToastItem` replace

```tsx
  /** null = stays until the user closes it. */
  duration: number | null;
}
```

with

```tsx
  /** null = stays until the user closes it. */
  duration: number | null;
  action?: ToastAction;
}
```

In `push` replace

```tsx
  toasts = [...toasts, { id, tone, text, title: opts?.title, duration }].slice(-MAX_VISIBLE);
```

with

```tsx
  toasts = [...toasts, { id, tone, text, title: opts?.title, duration, action: opts?.action }].slice(-MAX_VISIBLE);
```

- [ ] **Step 4: The button and the pause**

In `ToastCard` replace

```tsx
  const urgent = item.tone === 'warning' || item.tone === 'danger';

  return (
    <div
      className={cx('ui-toast', `ui-toast--${item.tone}`, leaving && 'ui-toast--out')}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? undefined : 'polite'}
      onMouseEnter={urgent ? pause : undefined}
      onMouseLeave={urgent ? arm : undefined}
    >
      <div className="ui-toast-text">
        {item.title && <b className="ui-toast-title">{item.title}</b>}
        <span className="ui-toast-body">{item.text}</span>
      </div>
      <Button
```

with

```tsx
  const urgent = item.tone === 'warning' || item.tone === 'danger';
  // A toast with an action waits while the pointer or the focus is on it, so the action stays reachable.
  const pausable = urgent || item.action !== undefined;

  return (
    <div
      className={cx('ui-toast', `ui-toast--${item.tone}`, leaving && 'ui-toast--out')}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? undefined : 'polite'}
      onMouseEnter={pausable ? pause : undefined}
      onMouseLeave={pausable ? arm : undefined}
      onFocus={item.action ? pause : undefined}
      onBlur={item.action ? arm : undefined}
    >
      <div className="ui-toast-text">
        {item.title && <b className="ui-toast-title">{item.title}</b>}
        <span className="ui-toast-body">{item.text}</span>
      </div>
      {item.action && <ToastActionButton action={item.action} disabled={leaving} onDone={close} />}
      <Button
```

and, immediately before the comment `/** The one viewport for the whole admin.`, add:

```tsx
/** The toast's action: runs once (disabled while the toast leaves), then closes the toast. */
function ToastActionButton({ action, disabled, onDone }: { action: ToastAction; disabled: boolean; onDone: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="ui-toast-action"
      disabled={disabled}
      onClick={() => {
        action.onClick();
        onDone();
      }}
    >
      {action.label}
    </Button>
  );
}

```

(Needs decision 6, option B: render the close `Button` only when `!item.action`.)

In `src/admin/ui/styles.ts`, after `${R} .ui-toast-close{flex-shrink:0;align-self:flex-start}`, add:

```ts
${R} .ui-toast-action{flex-shrink:0;align-self:center;color:var(--theme-primary);font-weight:700}
```

In `src/admin/ui/index.ts`, in the Toast export block, after `type ToastOptions,` add `type ToastAction,`.

- [ ] **Step 5: Run the checks**

Run: `npx vitest run src/club/__tests__/admin-toast-action.test.ts` (PASS, 3 tests), `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`.

- [ ] **Step 6: Commit**

```bash
git add src/admin/ui/Toast.tsx src/admin/ui/styles.ts src/admin/ui/index.ts src/club/__tests__/admin-toast-action.test.ts
git commit -m "feat(admin-ui): toast action button for undo"
```

---

### Task 7: BottomSheet

**Files:**
- Create: `src/club/ui-sheet.ts`, `src/admin/ui/BottomSheet.tsx`
- Modify: `src/admin/ui/styles.ts` (after the drawer's reduced-motion line, about line 256), `src/admin/ui/index.ts`
- Test: `src/club/__tests__/ui-sheet.test.ts`

**Interfaces:**
- Consumes: Task 1 `Popover` (`arrow`), `useIsPhone`, tokens `sheet` / `lg` / `handle`; `Modal`, `layerStack` (`pushLayer`, `isTopLayer`, `trapTab`), `Button`, `IconClose`.
- Produces: `closeDistance`, `closesOnRelease(drag: SheetDrag): boolean`, `dragOffset`; `BottomSheet` (`BottomSheetProps`, see "Interfaces for other plans"). Phone: `.ui-sheet-layer` (z `--ui-z-sheet`) > `.ui-sheet[role=dialog]` > `.ui-sheet-h` (grab handle, `h2` title, X "Închide"), `.ui-sheet-b`, `.ui-sheet-f`. Desktop: `.ui-pop.ui-sheetdd[role=dialog]` > `.ui-sheetdd-b`, `.ui-sheetdd-f`; or the Modal.

The approved behaviour (bottom-sheet-v1, v2; spec 8): phones slide up, rounded top corners, grab handle, title + X, scrolling body at most 85% high, sticky footer, safe-area padding, closes on X, overlay, swipe down and Escape, same focus trap and layer stack as Modal / Drawer; the full-height variant for the confirm window (4.8) and the athlete record (6.1); on desktop the same content as a rich dropdown under its button (arrow, soft shadow, 8px corners, no overlay, outside click and Escape close, focus back to the button). The confirm window is a Modal on desktop (`desktop="modal"`), the athlete record a page (the Sportivi plan mounts the sheet only when `useIsPhone()`).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/ui-sheet.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDistance, closesOnRelease, dragOffset } from '../ui-sheet';

// The admin bundle has no test runner; these read its source.
const source = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

describe('swipe down', () => {
  it('closeDistance is a quarter of the sheet height, at most 120px', () => {
    expect(closeDistance(400)).toBe(100);
    expect(closeDistance(800)).toBe(120);
  });

  it('a release far enough down closes; a short slow drag or an upward drag does not', () => {
    expect(closesOnRelease({ dy: 110, ms: 900, height: 400 })).toBe(true);
    expect(closesOnRelease({ dy: 60, ms: 900, height: 400 })).toBe(false);
    expect(closesOnRelease({ dy: -200, ms: 100, height: 400 })).toBe(false);
  });

  it('a quick flick closes, a tiny one does not', () => {
    expect(closesOnRelease({ dy: 40, ms: 60, height: 800 })).toBe(true);
    expect(closesOnRelease({ dy: 20, ms: 10, height: 800 })).toBe(false);
  });

  it('the sheet follows the finger downwards only', () => {
    expect(dragOffset(35)).toBe(35);
    expect(dragOffset(-20)).toBe(0);
  });
});

describe('BottomSheet wiring', () => {
  it('shares the layer stack and focus trap of Modal and Drawer', () => {
    const sheet = source('admin/ui/BottomSheet.tsx');
    expect(sheet).toContain('pushLayer(token)');
    expect(sheet).toContain('trapTab(e, boxRef.current)');
  });

  it('sits on the sheet layer, 85% high at most, full height as a variant, safe-area padded', () => {
    const css = source('admin/ui/styles.ts');
    expect(css).toContain('z-index:var(--ui-z-sheet');
    expect(css).toContain('max-height:85dvh');
    expect(css).toContain('.ui-sheet--full{height:100dvh;max-height:100dvh}');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/__tests__/ui-sheet.test.ts`
Expected: FAIL (`Failed to resolve import "../ui-sheet"`).

- [ ] **Step 3: The swipe rules**

`src/club/ui-sheet.ts`:

```ts
/**
 * Swipe-down rules of the admin BottomSheet on phones (src/admin/ui/BottomSheet.tsx).
 * Pure: no DOM, no React.
 */

export interface SheetDrag {
  /** Pixels dragged; positive = down. */
  dy: number;
  /** Duration of the drag in ms. */
  ms: number;
  /** Height of the sheet in px. */
  height: number;
}

/** A flick (a fast, short drag) closes too: at least this fast (px/ms)... */
const FLICK_SPEED = 0.5;
/** ...over at least this many px. */
const FLICK_MIN = 24;

/** Pixels to drag down before a release closes the sheet: a quarter of its height, at most 120. */
export function closeDistance(height: number): number {
  return Math.min(120, Math.round(height / 4));
}

/** True when releasing the drag closes the sheet. Upward drags never close. */
export function closesOnRelease({ dy, ms, height }: SheetDrag): boolean {
  if (dy <= 0) return false;
  if (dy >= closeDistance(height)) return true;
  return dy >= FLICK_MIN && ms > 0 && dy / ms >= FLICK_SPEED;
}

/** Offset of the sheet while dragging: it follows the finger downwards only. */
export function dragOffset(dy: number): number {
  return Math.max(0, dy);
}
```

- [ ] **Step 4: The component**

`src/admin/ui/BottomSheet.tsx`:

```tsx
import * as React from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { ensureAdminUi } from './styles';
import { isTopLayer, pushLayer, trapTab } from './layerStack';
import { Button } from './Button';
import { Modal } from './Modal';
import { Popover } from './Popover';
import { IconClose } from './icons';
import { useIsPhone } from './useMediaQuery';
import { closesOnRelease, dragOffset } from '../../club/ui-sheet';

/**
 * One piece of content, two shapes (DECISIONS 2026-10-06 bottom-sheet-v1/v2):
 * - phones (<= 640px): a panel sliding up from the bottom, rounded top
 *   corners, grab handle, title + X, scrolling body (85% of the screen at
 *   most, or the full height with `fullHeight`), sticky footer, safe-area
 *   padding; closes on X, overlay tap, swipe down and Escape; same layer
 *   stack and focus trap as Modal / Drawer, focus back to the opener;
 * - wider screens: `desktop="dropdown"` (default) shows the same content as a
 *   rich dropdown under `anchorRef` (arrow, soft shadow, 8px corners, no
 *   overlay; closes on outside click and Escape, focus back to the button);
 *   `desktop="modal"`, or no `anchorRef`, uses the existing Modal.
 *
 * Portals carry `.ui-root`, so the SaveBar tagger skips their buttons.
 */
export interface BottomSheetProps {
  open: boolean;
  /** Close request: X, overlay, swipe down, Escape, outside click (dropdown). */
  onClose: () => void;
  /** Header title (phone, Modal). A node is allowed (e.g. a back link). */
  title: React.ReactNode;
  /** Accessible name when `title` is not plain text; also names the dropdown. */
  ariaLabel?: string;
  children?: React.ReactNode;
  /** Sticky footer (phone), footer row (dropdown, Modal). */
  footer?: React.ReactNode;
  /** Phones: fill the screen height (confirm window, athlete record). Default false: 85% at most. */
  fullHeight?: boolean;
  /** Wider screens: 'dropdown' (default, needs anchorRef) or 'modal'. */
  desktop?: 'dropdown' | 'modal';
  /** The button the dropdown hangs from; focus returns to it on close. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Dropdown width in px; default: its content's width. */
  dropdownWidth?: number;
  /** Modal width on wider screens (desktop="modal"). Default 'sm'. */
  modalSize?: 'sm' | 'md' | 'lg';
  /** false blocks every close request (e.g. while a request runs). Default true. */
  dismissable?: boolean;
  /** Element to focus on open. Default: the panel. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  bodyClassName?: string;
}

type Ref<T> = React.RefObject<T | null>;
type SheetProps = BottomSheetProps & { dismissable: boolean };

/** Layer stack, focus in on open, focus back to the opener on close (as Modal and Drawer). */
function useLayerFocus(open: boolean, token: symbol, boxRef: Ref<HTMLElement>, initialFocusRef?: Ref<HTMLElement>): void {
  React.useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    const pop = pushLayer(token);
    const t = window.setTimeout(() => (initialFocusRef?.current ?? boxRef.current)?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      pop();
      if (opener && document.contains(opener)) opener.focus();
    };
    // initialFocusRef and boxRef are ref objects: stable by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);
}

/** Escape closes and Tab stays inside, for the top layer only. */
function useLayerKeys(open: boolean, token: symbol, boxRef: Ref<HTMLElement>, onClose: () => void, dismissable: boolean): void {
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const dismissRef = React.useRef(dismissable);
  dismissRef.current = dismissable;
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (!isTopLayer(token) || e.defaultPrevented) return;
      if (e.key === 'Escape' && dismissRef.current) closeRef.current();
      else if (e.key === 'Tab' && boxRef.current) trapTab(e, boxRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, token, boxRef]);
}

/** The page behind does not scroll while the sheet is open. */
function useScrollLock(open: boolean): void {
  React.useEffect(() => {
    if (!open) return undefined;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, [open]);
}

/** Swipe down on the header to close; the sheet follows the finger while dragging. */
function useSwipeDown(boxRef: Ref<HTMLElement>, onRelease: () => void) {
  const [dy, setDy] = React.useState(0);
  const start = React.useRef<{ y: number; at: number } | null>(null);
  const reset = () => {
    start.current = null;
    setDy(0);
  };
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if ((e.target as Element).closest('button')) return;
      start.current = { y: e.clientY, at: Date.now() };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => start.current && setDy(dragOffset(e.clientY - start.current.y)),
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const s = start.current;
      reset();
      const drag = s ? { dy: e.clientY - s.y, ms: Date.now() - s.at, height: boxRef.current?.offsetHeight ?? 0 } : null;
      if (drag && closesOnRelease(drag)) onRelease();
    },
    onPointerCancel: reset,
  };
  const style: React.CSSProperties | undefined = dy > 0 ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined;
  return { handlers, style };
}

interface HeadProps {
  titleId: string;
  title: React.ReactNode;
  dismissable: boolean;
  onClose: () => void;
  drag: React.HTMLAttributes<HTMLElement>;
}

/** Grab handle, title and X; the whole header is the drag area (buttons excepted). */
function SheetHead({ titleId, title, dismissable, onClose, drag }: HeadProps) {
  return (
    <div className="ui-sheet-h" {...drag}>
      <span className="ui-sheet-grab" aria-hidden="true" />
      <div className="ui-sheet-hrow">
        <h2 className="ui-sheet-title" id={titleId}>
          {title}
        </h2>
        <Button variant="ghost" size="sm" iconOnly icon={<IconClose />} aria-label="Închide" disabled={!dismissable} onClick={onClose} />
      </div>
    </div>
  );
}

/** The phone panel. */
function PhoneSheet(p: SheetProps) {
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const token = React.useMemo(() => Symbol('ui-sheet'), []);
  const titleId = React.useId();
  const requestClose = () => p.dismissable && p.onClose();
  useLayerFocus(p.open, token, boxRef, p.initialFocusRef);
  useLayerKeys(p.open, token, boxRef, p.onClose, p.dismissable);
  useScrollLock(p.open);
  const swipe = useSwipeDown(boxRef, requestClose);
  if (!p.open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="ui-root ui-sheet-layer" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={p.ariaLabel}
        aria-labelledby={p.ariaLabel ? undefined : titleId}
        tabIndex={-1}
        className={cx('ui-sheet', p.fullHeight && 'ui-sheet--full', p.className)}
        style={swipe.style}
      >
        <SheetHead titleId={titleId} title={p.title} dismissable={p.dismissable} onClose={p.onClose} drag={swipe.handlers} />
        <div className={cx('ui-sheet-b', p.bodyClassName)}>{p.children}</div>
        {p.footer && <div className="ui-sheet-f">{p.footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Focus into the dropdown on open, back to its button on close. */
function useDropdownFocus(open: boolean, anchorRef: Ref<HTMLElement>, panelRef: Ref<HTMLElement>, initialFocusRef?: Ref<HTMLElement>) {
  React.useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => (initialFocusRef?.current ?? panelRef.current)?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      anchorRef.current?.focus();
    };
    // Ref objects: stable by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/** The desktop dropdown: a Popover with an arrow, no overlay. */
function SheetDropdown(p: SheetProps & { anchorRef: Ref<HTMLElement> }) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  useDropdownFocus(p.open, p.anchorRef, panelRef, p.initialFocusRef);
  const label = p.ariaLabel ?? (typeof p.title === 'string' ? p.title : undefined);
  return (
    <Popover
      open={p.open}
      anchorRef={p.anchorRef}
      onClose={p.dismissable ? p.onClose : undefined}
      arrow
      offset={10}
      role="dialog"
      popoverRef={panelRef}
      className={cx('ui-sheetdd', p.className)}
      popoverProps={{ 'aria-label': label, tabIndex: -1, style: p.dropdownWidth ? { width: p.dropdownWidth } : undefined }}
    >
      <div className={cx('ui-sheetdd-b', p.bodyClassName)}>{p.children}</div>
      {p.footer && <div className="ui-sheetdd-f">{p.footer}</div>}
    </Popover>
  );
}

export function BottomSheet({ desktop = 'dropdown', dismissable = true, ...props }: BottomSheetProps) {
  React.useInsertionEffect(() => ensureAdminUi(), []);
  const phone = useIsPhone();
  if (phone) return <PhoneSheet {...props} dismissable={dismissable} />;
  if (desktop === 'dropdown' && props.anchorRef) return <SheetDropdown {...props} dismissable={dismissable} anchorRef={props.anchorRef} />;
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      footer={props.footer}
      size={props.modalSize}
      dismissable={dismissable}
      initialFocusRef={props.initialFocusRef}
      className={props.className}
      bodyClassName={props.bodyClassName}
    >
      {props.children}
    </Modal>
  );
}

export default BottomSheet;
```

In `src/admin/ui/styles.ts`, after the line

```ts
@media (prefers-reduced-motion:reduce){${R} .ui-drawer{animation:none}${R} .ui-dsec-chev{transition:none}}
```

add

```ts

/* bottom sheet (bottom-sheet-v1/v2): phones; on wider screens the same content is a dropdown (.ui-sheetdd) or a Modal */
.ui-root.ui-sheet-layer{position:fixed;inset:0;z-index:var(--ui-z-sheet,100150);display:flex;flex-direction:column;justify-content:flex-end;background:var(--theme-overlay)}
${R} .ui-sheet{display:flex;flex-direction:column;width:100%;max-height:85dvh;background:var(--theme-surface);color:var(--theme-text);border-radius:var(--ui-radius-sheet);box-shadow:var(--theme-shadow-md);outline:none;transition:transform var(--ui-motion-fast) var(--ui-easing);animation:ui-sheet-in var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-sheet--full{height:100dvh;max-height:100dvh}
${R} .ui-sheet-h{flex-shrink:0;padding:8px 16px 6px;touch-action:none;cursor:grab}
${R} .ui-sheet-grab{display:block;width:40px;height:4px;margin:0 auto 10px;background:var(--theme-border-strong);border-radius:var(--ui-radius-handle)}
${R} .ui-sheet-hrow{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-2)}
${R} .ui-sheet-title{margin:0;min-width:0;font-size:15px;font-weight:700;color:var(--theme-text)}
${R} .ui-sheet-b{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 16px 12px}
${R} .ui-sheet-f{flex-shrink:0;display:flex;gap:8px;padding:12px 16px;padding-bottom:max(12px, env(safe-area-inset-bottom));border-top:1px solid var(--theme-border)}
${R} .ui-sheet-f > *{flex:1}
${R} .ui-sheet-f .ui-btn{min-height:40px}
@keyframes ui-sheet-in{from{transform:translateY(100%)}to{transform:translateY(0)}}
@media (prefers-reduced-motion:reduce){${R} .ui-sheet{animation:none;transition:none}}
.ui-root.ui-pop.ui-sheetdd{display:flex;flex-direction:column;max-width:calc(100vw - 16px);max-height:min(560px, calc(100vh - 32px));border-radius:var(--ui-radius-lg);outline:none}
${R} .ui-sheetdd-b{flex:1;min-height:0;overflow-y:auto}
${R} .ui-sheetdd-f{display:flex;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid var(--theme-border)}
```

In `src/admin/ui/index.ts`, after the Drawer export line, add:

```ts
export { BottomSheet, type BottomSheetProps } from './BottomSheet';
```

- [ ] **Step 5: Run the checks**

Run: `npx vitest run src/club/__tests__/ui-sheet.test.ts` (PASS, 6 tests), `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`.

- [ ] **Step 6: Commit**

```bash
git add src/club/ui-sheet.ts src/club/__tests__/ui-sheet.test.ts src/admin/ui/BottomSheet.tsx src/admin/ui/styles.ts src/admin/ui/index.ts
git commit -m "feat(admin-ui): BottomSheet, phone panel and desktop dropdown"
```

---

### Task 8: Selected style E

**Files:**
- Modify: `src/admin/ui/styles.ts:309`
- Test: `src/club/__tests__/admin-selected-style.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every `.ui-inbox-item[aria-current="true"]` (Mesaje, form results, any InboxLayout) in style E: solid primary fill inset 4px with 6px corners, white text, no left bar, no outline (DECISIONS 2026-10-06 selected-state-v2 option E). The filter section nav gets the same style in Task 9. No layout shift: the fill is a `::before`, the row keeps its height.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-selected-style.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const css = readFileSync(join(__dirname, '..', '..', 'admin', 'ui', 'styles.ts'), 'utf8');

it('the old selected inbox item (tint + inset left bar) is gone', () => {
  expect(css).not.toContain('box-shadow:inset 3px 0 0 var(--theme-primary)}');
});

it('a selected inbox item uses style E: solid primary, 6px corners, 4px inset, white text', () => {
  const fill = /\.ui-inbox-item\[aria-current="true"\]::before\{[^}]*\}/.exec(css)?.[0] ?? '';
  expect(fill).toContain('inset:4px');
  expect(fill).toContain('background:var(--theme-primary)');
  expect(fill).toContain('border-radius:var(--ui-radius-md)');
  expect(css).toContain('.ui-inbox-item[aria-current="true"]{background:none;color:var(--theme-on-primary)}');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/__tests__/admin-selected-style.test.ts`
Expected: FAIL (2 tests).

- [ ] **Step 3: The style**

In `src/admin/ui/styles.ts` replace the line

```ts
${R} .ui-inbox-item[aria-current="true"]{background:var(--theme-primary-soft);box-shadow:inset 3px 0 0 var(--theme-primary)}
```

with

```ts
/* selected item, style E (selected-state-v2): solid primary, white text, 6px corners, 4px inset, no bar, no outline */
${R} .ui-inbox-item{position:relative}
${R} .ui-inbox-item > *{position:relative}
${R} .ui-inbox-item[aria-current="true"]{background:none;color:var(--theme-on-primary)}
${R} .ui-inbox-item[aria-current="true"]::before{content:"";position:absolute;inset:4px;background:var(--theme-primary);border-radius:var(--ui-radius-md)}
${R} .ui-inbox-item[aria-current="true"] .ui-inbox-time,${R} .ui-inbox-item[aria-current="true"] .ui-inbox-snip{color:var(--theme-on-primary)}
```

- [ ] **Step 4: Run the checks**

Run: `npx vitest run src/club/__tests__/admin-selected-style.test.ts` (PASS), `node scripts/admin-ui-check.mjs --strict`.

- [ ] **Step 5: Commit**

```bash
git add src/admin/ui/styles.ts src/club/__tests__/admin-selected-style.test.ts
git commit -m "feat(admin-ui): selected style E for inbox items"
```

---

### Task 9: FilterPanel, filters-v3 (after Task 5)

**Files:**
- Create: `src/club/ui-filters.ts`, `src/admin/ui/FilterPanel.tsx`
- Modify: `src/admin/ui/styles.ts` (after `.ui-stat-caption`, the last rule of `UI_CSS`), `src/admin/ui/index.ts`
- Test: `src/club/__tests__/ui-filters.test.ts`

**Interfaces:**
- Consumes: Task 2 `foldText`; Task 5 `Radio`; Task 7 `BottomSheet`; Task 1 `useIsPhone`, `IconChevronLeft`, `IconChevronRight`; `Button`, `Checkbox`, `Input`.
- Produces: `FilterChoice`, `FilterSectionState`, `ALL_LABEL`, `SEARCH_ABOVE`, `sectionSummary`, `toggleChoice`, `needsSearch`, `matchOptions`, `activeSections`; `FilterPanel` (`FilterPanelProps`, `FilterSection`), see "Interfaces for other plans".

The decided layout (filters-v3; spec 5; 3b Q9, Q30; gaps #10): a "Filtre" button with the number of active sections. Desktop: dropdown (BottomSheet) 540px wide, sections on the left, each with its value under the name (chosen value in blue, otherwise "Toate"), the open section in style E; options on the right in even 36px rows; no per-option counts; a search box only above 8 options; live total at the bottom with "Șterge tot" and "Gata"; choices apply at once, "Gata" only closes. Phone: the bottom sheet lists the sections with their value and a chevron, a tap drills into the options ("‹ Filtre" back), footer "Șterge tot" or "Șterge" (one section) and "Arată N ..." (the caller's text, singular included). Sort on phones can be one more `single` section or its own BottomSheet; that is the caller's choice.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/ui-filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { activeSections, matchOptions, needsSearch, sectionSummary, toggleChoice } from '../ui-filters';

const grupa = {
  options: [
    { value: 'pp', label: 'Primii Pași' },
    { value: 'inc', label: 'Începători' },
    { value: 'ab', label: 'Avansați Bronze' },
  ],
  selected: [] as string[],
};

describe('sectionSummary', () => {
  it('shows "Toate" when nothing is chosen', () => {
    expect(sectionSummary(grupa)).toBe('Toate');
  });

  it('shows the chosen labels in option order', () => {
    expect(sectionSummary({ ...grupa, selected: ['ab', 'pp'] })).toBe('Primii Pași, Avansați Bronze');
  });

  it('uses the section own summary when given', () => {
    expect(sectionSummary({ ...grupa, selected: ['ab'], summary: 'Avansați' })).toBe('Avansați');
  });
});

describe('toggleChoice', () => {
  it('adds and removes values in a multi section', () => {
    expect(toggleChoice({ selected: ['pp'] }, 'inc')).toEqual(['pp', 'inc']);
    expect(toggleChoice({ selected: ['pp', 'inc'] }, 'pp')).toEqual(['inc']);
  });

  it('keeps one value in a single section', () => {
    expect(toggleChoice({ selected: ['pp'], single: true }, 'inc')).toEqual(['inc']);
    expect(toggleChoice({ selected: ['pp'], single: true }, 'pp')).toEqual(['pp']);
  });
});

describe('search and count', () => {
  it('a search box only above 8 options', () => {
    expect(needsSearch(8)).toBe(false);
    expect(needsSearch(9)).toBe(true);
  });

  it('matchOptions ignores case and diacritics; blank text keeps everything', () => {
    expect(matchOptions(grupa.options, 'INCEP').map((o) => o.value)).toEqual(['inc']);
    expect(matchOptions(grupa.options, '  ')).toHaveLength(3);
  });

  it('activeSections counts the sections with something chosen', () => {
    expect(activeSections([{ selected: [] }, { selected: ['a'] }, { selected: ['b', 'c'] }])).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/__tests__/ui-filters.test.ts`
Expected: FAIL (`Failed to resolve import "../ui-filters"`).

- [ ] **Step 3: The rules**

`src/club/ui-filters.ts` (Needs decision 3, option B: `sectionSummary` returns the count text for two or more labels instead of joining them):

```ts
import { foldText } from './ui-select';

/**
 * Rules of the admin filter panel, filters-v3 layout (src/admin/ui/FilterPanel.tsx;
 * DECISIONS 2026-10-06 filters-v3). Pure: no DOM, no React.
 */

/** One option of a filter section. */
export interface FilterChoice {
  value: string;
  label: string;
}

export interface FilterSectionState {
  options: FilterChoice[];
  /** Chosen values; empty = everything ("Toate"). */
  selected: string[];
  /** One value at a time (radio rows). Default: several (checkbox rows). */
  single?: boolean;
  /** Overrides the text under the section name. */
  summary?: string;
}

/** Text under a section with nothing chosen (filters-v3). */
export const ALL_LABEL = 'Toate';
/** A section gets a search box only above this many options (filters-v3). */
export const SEARCH_ABOVE = 8;
/** Joins several chosen labels under the section name (plan 3-1, Needs decision 3). */
export const SUMMARY_JOIN = ', ';

/** Text under a section name: its own summary, "Toate" when nothing is chosen, else the chosen labels in option order. */
export function sectionSummary(s: FilterSectionState): string {
  if (s.summary !== undefined) return s.summary;
  const labels = s.options.filter((o) => s.selected.includes(o.value)).map((o) => o.label);
  return labels.length > 0 ? labels.join(SUMMARY_JOIN) : ALL_LABEL;
}

/** Selection after a click on an option: toggled in a multi section, the only one in a single section. */
export function toggleChoice(s: Pick<FilterSectionState, 'selected' | 'single'>, value: string): string[] {
  if (s.single) return [value];
  return s.selected.includes(value) ? s.selected.filter((v) => v !== value) : [...s.selected, value];
}

/** True when a section is long enough for a search box. */
export function needsSearch(optionCount: number): boolean {
  return optionCount > SEARCH_ABOVE;
}

/** Options whose label contains the typed text, case and diacritics ignored. */
export function matchOptions(options: FilterChoice[], query: string): FilterChoice[] {
  const q = foldText(query.trim());
  return q ? options.filter((o) => foldText(o.label).includes(q)) : options;
}

/** Sections with something chosen: the number on the "Filtre" button. */
export function activeSections(sections: ReadonlyArray<Pick<FilterSectionState, 'selected'>>): number {
  return sections.filter((s) => s.selected.length > 0).length;
}
```

- [ ] **Step 4: The component**

`src/admin/ui/FilterPanel.tsx` (Needs decision 4, option B: drop the `placeholder` prop of the search `Input` and the `SEARCH_PLACEHOLDER` constant):

```tsx
import * as React from 'react';
import { cx } from './cx';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Input } from './Input';
import { Radio } from './Radio';
import { BottomSheet } from './BottomSheet';
import { useIsPhone } from './useMediaQuery';
import { IconChevronLeft, IconChevronRight } from './icons';
import {
  activeSections,
  matchOptions,
  needsSearch,
  sectionSummary,
  toggleChoice,
  type FilterChoice,
} from '../../club/ui-filters';

/** One filter section: its name, its options and what is chosen. */
export interface FilterSection {
  key: string;
  label: string;
  options: FilterChoice[];
  /** Chosen values; empty = "Toate". */
  selected: string[];
  /** One value at a time (radio rows). Default: several (checkbox rows). */
  single?: boolean;
  /** Text under the section name; default "Toate" or the chosen labels. */
  summary?: string;
}

export interface FilterPanelProps {
  sections: FilterSection[];
  /** A section's new selection; filters apply at once, the list stays visible. */
  onChange: (key: string, selected: string[]) => void;
  /** "Șterge tot": clear every section. */
  onClearAll: () => void;
  /** Live total in the desktop footer, e.g. "218 sportivi". */
  totalLabel: string;
  /** Phone footer button, e.g. "Arată 218 sportivi" / "Arată 1 sportiv". */
  showLabel: string;
  /** Button text. Default "Filtre". */
  buttonLabel?: string;
  className?: string;
}

const FILTERS = 'Filtre';
/** Search box placeholder in a long section (plan 3-1, Needs decision 4). */
const SEARCH_PLACEHOLDER = 'Caută...';
/** Width of the desktop dropdown (filters-v3). */
const DROPDOWN_WIDTH = 540;

type OnChange = FilterPanelProps['onChange'];

/** The options of one section: 36px rows, checkbox or radio; a search box above 8 options. */
function FilterOptions({ section, onChange }: { section: FilterSection; onChange: OnChange }) {
  const [query, setQuery] = React.useState('');
  const name = React.useId();
  const pick = (value: string) => onChange(section.key, toggleChoice(section, value));
  return (
    <div className="ui-fopts">
      {needsSearch(section.options.length) && (
        <Input
          className="ui-fopts-search"
          value={query}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label={section.label}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {matchOptions(section.options, query).map((o) => {
        const on = section.selected.includes(o.value);
        return section.single ? (
          <Radio key={o.value} name={name} value={o.value} checked={on} onChange={() => pick(o.value)} label={o.label} />
        ) : (
          <Checkbox key={o.value} checked={on} onChange={() => pick(o.value)} label={o.label} />
        );
      })}
    </div>
  );
}

interface BodyProps {
  sections: FilterSection[];
  current: string | null;
  onPick: (key: string | null) => void;
  onChange: OnChange;
}

/** Desktop: sections on the left with their value, the open section's options on the right. */
function DesktopBody({ sections, current, onPick, onChange }: BodyProps) {
  const section = sections.find((s) => s.key === current) ?? sections[0];
  return (
    <div className="ui-fdesk">
      <div className="ui-fnav">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            className="ui-fnav-item"
            aria-current={s.key === section?.key || undefined}
            data-set={s.selected.length > 0 || undefined}
            onClick={() => onPick(s.key)}
          >
            <b>{s.label}</b>
            <span>{sectionSummary(s)}</span>
          </button>
        ))}
      </div>
      <div className="ui-fpane">{section && <FilterOptions key={section.key} section={section} onChange={onChange} />}</div>
    </div>
  );
}

/** Phone: the list of sections with their value and a chevron; a tap drills into the options. */
function PhoneBody({ sections, current, onPick, onChange }: BodyProps) {
  const section = sections.find((s) => s.key === current);
  if (section) {
    return (
      <>
        <b className="ui-fm-title">{section.label}</b>
        <FilterOptions key={section.key} section={section} onChange={onChange} />
      </>
    );
  }
  return (
    <div className="ui-fm-list">
      {sections.map((s) => (
        <button key={s.key} type="button" className="ui-fm-row" onClick={() => onPick(s.key)}>
          <span>
            <b>{s.label}</b>
            <small data-set={s.selected.length > 0 || undefined}>{sectionSummary(s)}</small>
          </span>
          <IconChevronRight />
        </button>
      ))}
    </div>
  );
}

/** "‹ Filtre": back from a section to the list of sections (phone). */
function BackToList({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ui-fback" onClick={onClick}>
      <IconChevronLeft size={12} />
      {label}
    </button>
  );
}

const FilterTrigger = React.forwardRef<HTMLButtonElement, { label: string; count: number; open: boolean; onClick: () => void }>(
  function FilterTrigger({ label, count, open, onClick }, ref) {
    return (
      <Button ref={ref} variant="secondary" className="ui-fbtn" aria-haspopup="dialog" aria-expanded={open} onClick={onClick}>
        {label}
        {count > 0 && <span className="ui-fbtn-n">{count}</span>}
      </Button>
    );
  },
);

interface FooterProps {
  phone: boolean;
  section: FilterSection | null;
  props: FilterPanelProps;
  close: () => void;
}

/** Desktop: live total, "Șterge tot", "Gata". Phone: "Șterge tot" / "Șterge" (one section) and "Arată N ...". */
function FilterFooter({ phone, section, props, close }: FooterProps) {
  if (!phone) {
    return (
      <>
        <span className="ui-ff-total">{props.totalLabel}</span>
        <span className="ui-ff-grow" />
        <Button variant="ghost" size="sm" onClick={props.onClearAll}>
          Șterge tot
        </Button>
        <Button size="sm" onClick={close}>
          Gata
        </Button>
      </>
    );
  }
  const clear = () => (section ? props.onChange(section.key, []) : props.onClearAll());
  return (
    <>
      <Button variant="secondary" onClick={clear}>
        {section ? 'Șterge' : 'Șterge tot'}
      </Button>
      <Button className="ui-ff-show" onClick={close}>
        {props.showLabel}
      </Button>
    </>
  );
}

/**
 * Filters, filters-v3 layout (DECISIONS 2026-10-06 filters-v3): a "Filtre"
 * button (with the number of active sections) opening a BottomSheet. Desktop:
 * dropdown, sections left with their value (chosen in blue, otherwise
 * "Toate"), options right in 36px rows, live total, "Șterge tot", "Gata".
 * Phone: the sections with their value and a chevron, a tap drills into the
 * options ("‹ Filtre" back), footer "Arată N ...". Choices apply at once.
 */
export function FilterPanel(props: FilterPanelProps) {
  const { sections, onChange, buttonLabel = FILTERS, className } = props;
  const anchorRef = React.useRef<HTMLButtonElement | null>(null);
  const phone = useIsPhone();
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setCurrent(null);
  };
  const section = phone ? (sections.find((s) => s.key === current) ?? null) : null;
  const Body = phone ? PhoneBody : DesktopBody;
  return (
    <span className={cx('ui-filters', className)}>
      <FilterTrigger ref={anchorRef} label={buttonLabel} count={activeSections(sections)} open={open} onClick={() => (open ? close() : setOpen(true))} />
      <BottomSheet
        open={open}
        onClose={close}
        title={section ? <BackToList label={buttonLabel} onClick={() => setCurrent(null)} /> : buttonLabel}
        ariaLabel={buttonLabel}
        anchorRef={anchorRef}
        dropdownWidth={DROPDOWN_WIDTH}
        footer={<FilterFooter phone={phone} section={section} props={props} close={close} />}
      >
        <Body sections={sections} current={current} onPick={setCurrent} onChange={onChange} />
      </BottomSheet>
    </span>
  );
}

export default FilterPanel;
```

In `src/admin/ui/styles.ts`, after the line starting `${R} .ui-stat-caption{` (the last rule before the closing backtick of `UI_CSS`), add:

```ts

/* filters (filters-v3): desktop dropdown with sections left, options right; phone drill-in bottom sheet */
${R} .ui-filters{display:inline-flex}
${R} .ui-fbtn-n{display:inline-block;min-width:16px;padding:0 5px;font-size:10.5px;line-height:16px;text-align:center;background:var(--theme-primary);color:var(--theme-on-primary);border-radius:var(--ui-radius-sm)}
${R} .ui-fdesk{display:grid;grid-template-columns:190px minmax(0,1fr);min-height:236px}
${R} .ui-fnav{display:flex;flex-direction:column;gap:2px;padding:8px;border-right:1px solid var(--theme-border);background:var(--theme-surface-subtle);border-top-left-radius:var(--ui-radius-lg)}
${R} .ui-fnav-item{display:block;width:100%;padding:9px 12px;border:none;border-radius:var(--ui-radius-md);background:none;font-family:inherit;text-align:left;color:var(--theme-text);cursor:pointer}
${R} .ui-fnav-item b{display:block;font-size:var(--ui-fs-body);font-weight:700}
${R} .ui-fnav-item span{display:block;margin-top:1px;font-size:12px;color:var(--theme-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${R} .ui-fnav-item[data-set] span{color:var(--theme-primary);font-weight:600}
${R} .ui-fnav-item:hover{background:var(--theme-surface)}
${R} .ui-fnav-item[aria-current="true"]{background:var(--theme-primary);color:var(--theme-on-primary)}
${R} .ui-fnav-item[aria-current="true"] span{color:var(--theme-on-primary)}
${R} .ui-fpane{min-width:0;padding:10px 12px}
${R} .ui-fopts{display:flex;flex-direction:column}
${R} .ui-fopts .ui-check,${R} .ui-fopts .ui-radio{display:flex;align-items:center;height:36px;padding:0 8px;border-radius:var(--ui-radius-sm)}
${R} .ui-fopts .ui-check input,${R} .ui-fopts .ui-radio input{margin-top:0}
${R} .ui-fopts .ui-check:hover,${R} .ui-fopts .ui-radio:hover{background:var(--theme-surface-subtle)}
${R} .ui-fopts-search{margin-bottom:6px}
${R} .ui-ff-total{font-weight:700}
${R} .ui-ff-grow{flex:1}
${R} .ui-sheet-f .ui-ff-show{flex:2}
${R} .ui-fback{display:inline-flex;align-items:center;gap:4px;padding:0;border:none;background:none;font-family:inherit;font-size:var(--ui-fs-body);font-weight:600;color:var(--theme-primary);cursor:pointer}
${R} .ui-fm-row{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-2);width:100%;padding:12px 2px;border:none;border-bottom:1px solid var(--theme-border);background:none;font-family:inherit;text-align:left;color:var(--theme-text);cursor:pointer}
${R} .ui-fm-row b{display:block;font-size:var(--ui-fs-body)}
${R} .ui-fm-row small{display:block;font-size:12px;color:var(--theme-text-muted)}
${R} .ui-fm-row small[data-set]{color:var(--theme-primary);font-weight:600}
${R} .ui-fm-title{display:block;margin:4px 0 8px;font-size:15px}
```

In `src/admin/ui/index.ts`, after the BottomSheet export, add:

```ts
export { FilterPanel, type FilterPanelProps, type FilterSection } from './FilterPanel';
export { sectionSummary, activeSections, ALL_LABEL, type FilterChoice } from '../../club/ui-filters';
```

- [ ] **Step 5: Run the checks**

Run: `npx vitest run src/club/__tests__/ui-filters.test.ts` (PASS, 8 tests), `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`.

- [ ] **Step 6: Commit**

```bash
git add src/club/ui-filters.ts src/club/__tests__/ui-filters.test.ts src/admin/ui/FilterPanel.tsx src/admin/ui/styles.ts src/admin/ui/index.ts
git commit -m "feat(admin-ui): FilterPanel in the filters-v3 layout"
```

---

### Task 10: BirthDatePicker zi / lună / an (waits for Needs decision 2)

**Files:**
- Create: `src/club/ui-birth-date.ts`, `src/admin/ui/BirthDatePicker.tsx`
- Modify: `src/admin/ui/Field.tsx` (before `export interface FieldProps`), `src/admin/ui/styles.ts` (after the filters block of Task 9, the last rule of `UI_CSS`), `src/admin/ui/index.ts`
- Test: `src/club/__tests__/ui-birth-date.test.ts`

**Interfaces:**
- Consumes: Task 2 `Select`; `useFieldControl`, `FieldAria`.
- Produces: `DateParts`, `EMPTY_DATE`, `BIRTH_YEARS_AGO`, `PART_LABELS`, `PART_PLACEHOLDERS`, `daysInMonth`, `isFullDate`, `withPart`, `dayChoices`, `monthChoices`, `birthYears`, `yearChoices`, `partsFromDisplay`, `partsToDisplay`, `partsFromIso`, `partsToIso`; `NoFieldContext`; `BirthDatePicker` (`BirthDatePickerProps`). Spec 3.4 / 6.2: "same three selects and year range as the website (9), a stored year outside the range stays selectable"; registrations store ZZ.LL.AAAA, `athlete.birthDate` is a date (AAAA-LL-ZZ).

The code is written with option A of every part of Needs decision 2. For option B: 2a, `dayChoices` labels `pad2(i + 1)` and `MONTHS` becomes `01` to `12` (update the two label assertions); 2b, sort `a - b` in `birthYears` (update the first/last assertions); 2c, `PART_PLACEHOLDERS = {}`; 2d, `withPart` returns `next` unchanged and the callers refuse `!isFullDate(parts)` with the decided error copy (replace the two "clears a day" assertions with `isFullDate` assertions).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/ui-birth-date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  EMPTY_DATE,
  birthYears,
  dayChoices,
  daysInMonth,
  isFullDate,
  monthChoices,
  partsFromDisplay,
  partsFromIso,
  partsToDisplay,
  partsToIso,
  withPart,
} from '../ui-birth-date';

describe('daysInMonth', () => {
  it('knows short months and leap years', () => {
    expect(daysInMonth(4, 2016)).toBe(30);
    expect(daysInMonth(1, 2016)).toBe(31);
    expect(daysInMonth(2, 2016)).toBe(29);
    expect(daysInMonth(2, 2015)).toBe(28);
    expect(daysInMonth(2, 1900)).toBe(28);
    expect(daysInMonth(2, 2000)).toBe(29);
  });

  it('allows the most days while month or year is unknown', () => {
    expect(daysInMonth(2, null)).toBe(29);
    expect(daysInMonth(null, null)).toBe(31);
  });
});

describe('years', () => {
  it('run from 2 to 25 years ago, newest first', () => {
    const years = birthYears(2026, null);
    expect(years[0]).toBe(2024);
    expect(years[years.length - 1]).toBe(2001);
    expect(years).toHaveLength(24);
  });

  it('keep a stored year outside the range selectable, once', () => {
    expect(birthYears(2026, 1998)).toHaveLength(25);
    expect(birthYears(2026, 1998)[24]).toBe(1998);
    expect(birthYears(2026, 2025)[0]).toBe(2025);
    expect(birthYears(2026, 2010)).toHaveLength(24);
  });
});

describe('day and month rows', () => {
  it('the day rows follow the month and year', () => {
    expect(dayChoices({ day: null, month: 2, year: 2015 })).toHaveLength(28);
    expect(dayChoices(EMPTY_DATE)).toHaveLength(31);
    expect(dayChoices(EMPTY_DATE)[0]).toEqual({ value: 1, label: '1' });
  });

  it('months are listed by name', () => {
    expect(monthChoices()).toHaveLength(12);
    expect(monthChoices()[0]).toEqual({ value: 1, label: 'ianuarie' });
    expect(monthChoices()[2]).toEqual({ value: 3, label: 'martie' });
  });
});

describe('withPart', () => {
  it('clears a day that no longer fits; never yields an impossible date', () => {
    expect(withPart({ day: 31, month: 1, year: 2016 }, 'month', 4)).toEqual({ day: null, month: 4, year: 2016 });
    expect(withPart({ day: 29, month: 2, year: 2016 }, 'year', 2015)).toEqual({ day: null, month: 2, year: 2015 });
  });

  it('keeps a day that still fits', () => {
    expect(withPart({ day: 14, month: 3, year: null }, 'year', 2016)).toEqual({ day: 14, month: 3, year: 2016 });
    expect(withPart({ day: 14, month: 3, year: 2016 }, 'month', null)).toEqual({ day: 14, month: null, year: 2016 });
  });
});

describe('stored formats', () => {
  it('reads ZZ.LL.AAAA, refuses other text and impossible dates', () => {
    expect(partsFromDisplay('14.03.2016')).toEqual({ day: 14, month: 3, year: 2016 });
    expect(partsFromDisplay(' 14.03.2016 ')).toEqual({ day: 14, month: 3, year: 2016 });
    expect(partsFromDisplay('31.02.2016')).toBeNull();
    expect(partsFromDisplay('14 martie 2016')).toBeNull();
    expect(partsFromDisplay(null)).toBeNull();
  });

  it('writes ZZ.LL.AAAA only for a complete, real date', () => {
    expect(partsToDisplay({ day: 4, month: 3, year: 2016 })).toBe('04.03.2016');
    expect(partsToDisplay({ day: 4, month: null, year: 2016 })).toBeNull();
    expect(isFullDate({ day: 30, month: 2, year: 2016 })).toBe(false);
  });

  it('reads and writes ISO dates for athlete.birthDate', () => {
    expect(partsFromIso('2016-03-04')).toEqual({ day: 4, month: 3, year: 2016 });
    expect(partsFromIso('2016-02-30')).toBeNull();
    expect(partsFromIso(null)).toBeNull();
    expect(partsToIso({ day: 4, month: 3, year: 2016 })).toBe('2016-03-04');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/__tests__/ui-birth-date.test.ts`
Expected: FAIL (`Failed to resolve import "../ui-birth-date"`).

- [ ] **Step 3: The rules**

`src/club/ui-birth-date.ts`:

```ts
/**
 * Rules of the admin birth date picker (src/admin/ui/BirthDatePicker.tsx):
 * three selects zi / lună / an, the website's year range (25 to 2 years ago),
 * a stored year outside that range kept selectable (spec 3.4, 6.2, 8, 9).
 * Pure: no DOM, no React. Reads and writes ZZ.LL.AAAA (registrations) and
 * AAAA-LL-ZZ (athlete.birthDate). Old free-text dates ("14 martie 2016",
 * "14/03/2016") are read by the registration rules (spec 1.3), not here.
 */

export interface DateParts {
  day: number | null;
  month: number | null;
  year: number | null;
}

interface FullDate {
  day: number;
  month: number;
  year: number;
}

/** One row of a part select. */
export interface PartChoice {
  value: number;
  label: string;
}

export const EMPTY_DATE: DateParts = { day: null, month: null, year: null };

/** The website's range (spec 9): from 25 years ago to 2 years ago. */
export const BIRTH_YEARS_AGO = { oldest: 25, newest: 2 } as const;

/** Accessible names of the three selects (spec: "zi / lună / an"). */
export const PART_LABELS = { day: 'Zi', month: 'Lună', year: 'An' } as const;

/** Text of the empty first row of each select (plan 3-1, Needs decision 2c). */
export const PART_PLACEHOLDERS: Partial<Record<keyof DateParts, string>> = { day: 'Zi', month: 'Lună', year: 'An' };

/** Month labels (plan 3-1, Needs decision 2a). */
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

const THIRTY_DAYS = [4, 6, 9, 11];
const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Days in a month; 31 while the month is unknown, 29 for February while the year is unknown. */
export function daysInMonth(month: number | null, year: number | null): number {
  if (month === null) return 31;
  if (month === 2) return year === null || isLeap(year) ? 29 : 28;
  return THIRTY_DAYS.includes(month) ? 30 : 31;
}

/** True when all three parts are set and make a real date. */
export function isFullDate(p: DateParts): p is FullDate {
  if (p.day === null || p.month === null || p.year === null) return false;
  return p.month >= 1 && p.month <= 12 && p.day >= 1 && p.day <= daysInMonth(p.month, p.year);
}

/** Parts after one select changes; a day that no longer fits the month and year is cleared (Needs decision 2d). */
export function withPart(p: DateParts, key: keyof DateParts, value: number | null): DateParts {
  const next: DateParts = { ...p, [key]: value };
  return next.day !== null && next.day > daysInMonth(next.month, next.year) ? { ...next, day: null } : next;
}

/** Day rows for the current month and year (Needs decision 2a: labels). */
export function dayChoices(p: DateParts): PartChoice[] {
  return Array.from({ length: daysInMonth(p.month, p.year) }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
}

/** Month rows (Needs decision 2a: labels). */
export function monthChoices(): PartChoice[] {
  return MONTHS.map((label, i) => ({ value: i + 1, label }));
}

/** Years from 2 to 25 years ago, plus a stored year outside that range (Needs decision 2b: order). */
export function birthYears(todayYear: number, keep: number | null): number[] {
  const years: number[] = [];
  for (let y = todayYear - BIRTH_YEARS_AGO.newest; y >= todayYear - BIRTH_YEARS_AGO.oldest; y--) years.push(y);
  if (keep !== null && !years.includes(keep)) years.push(keep);
  return years.sort((a, b) => b - a);
}

/** Year rows. */
export function yearChoices(todayYear: number, keep: number | null): PartChoice[] {
  return birthYears(todayYear, keep).map((y) => ({ value: y, label: String(y) }));
}

const DISPLAY = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const realOrNull = (p: DateParts): DateParts | null => (isFullDate(p) ? p : null);

/** "14.03.2016" -> parts; null for anything else or an impossible date. */
export function partsFromDisplay(text: string | null | undefined): DateParts | null {
  const m = DISPLAY.exec((text ?? '').trim());
  return m ? realOrNull({ day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) }) : null;
}

/** Parts -> "14.03.2016" (how registrations store it); null until the date is complete and real. */
export function partsToDisplay(p: DateParts): string | null {
  return isFullDate(p) ? `${pad2(p.day)}.${pad2(p.month)}.${p.year}` : null;
}

/** "2016-03-14" -> parts; null for anything else or an impossible date. */
export function partsFromIso(iso: string | null | undefined): DateParts | null {
  const m = ISO.exec((iso ?? '').trim());
  return m ? realOrNull({ day: Number(m[3]), month: Number(m[2]), year: Number(m[1]) }) : null;
}

/** Parts -> "2016-03-14" (athlete.birthDate); null until the date is complete and real. */
export function partsToIso(p: DateParts): string | null {
  return isFullDate(p) ? `${p.year}-${pad2(p.month)}-${pad2(p.day)}` : null;
}
```

- [ ] **Step 4: One Field id for a three-part control**

In `src/admin/ui/Field.tsx`, immediately before `export interface FieldProps {`, add:

```tsx
/**
 * Renders its children outside any enclosing Field, so a compound control
 * (BirthDatePicker) can hand the Field's id to one inner control only.
 */
export function NoFieldContext({ children }: { children: React.ReactNode }) {
  return <FieldContext.Provider value={null}>{children}</FieldContext.Provider>;
}

```

Without it, every inner Select would pick up the Field's id.

- [ ] **Step 5: The component**

`src/admin/ui/BirthDatePicker.tsx`:

```tsx
import * as React from 'react';
import { cx } from './cx';
import { NoFieldContext, useFieldControl, type FieldAria } from './Field';
import { Select, type SelectOption } from './Select';
import {
  PART_LABELS,
  PART_PLACEHOLDERS,
  dayChoices,
  monthChoices,
  withPart,
  yearChoices,
  type DateParts,
  type PartChoice,
} from '../../club/ui-birth-date';

export interface BirthDatePickerProps extends FieldAria {
  /** The three parts; EMPTY_DATE for none. Convert with partsFromDisplay / partsFromIso. */
  value: DateParts;
  /** New parts after any select changes; check completeness with partsToDisplay / partsToIso / isFullDate. */
  onChange: (next: DateParts) => void;
  /** Anchor of the year range (25 to 2 years ago). Default: today. */
  today?: Date;
  disabled?: boolean;
  className?: string;
}

const asText = (n: number | null): string => (n === null ? '' : String(n));
const asNumber = (v: string): number | null => (v === '' ? null : Number(v));
const asOptions = (list: PartChoice[]): SelectOption[] => list.map((c) => ({ value: String(c.value), label: c.label }));

/**
 * Birth date as three admin Selects zi / lună / an (spec 3.4, 6.2, 8): the
 * Înscrieri Editează form and the athlete record Date tab. Inside a Field the
 * label points at the day select; hint and error go to all three.
 */
export function BirthDatePicker({ value, onChange, today, disabled, className, ...rest }: BirthDatePickerProps) {
  const field = useFieldControl<FieldAria>(rest);
  const year = (today ?? new Date()).getFullYear();
  const set = (key: keyof DateParts) => (v: string) => onChange(withPart(value, key, asNumber(v)));
  const shared = { disabled, 'aria-describedby': field['aria-describedby'], 'aria-invalid': field['aria-invalid'], required: field.required };
  return (
    <div role="group" className={cx('ui-bdate', className)}>
      <NoFieldContext>
        <Select
          {...shared}
          id={field.id}
          aria-label={PART_LABELS.day}
          placeholder={PART_PLACEHOLDERS.day}
          value={asText(value.day)}
          options={asOptions(dayChoices(value))}
          onChange={set('day')}
        />
        <Select
          {...shared}
          aria-label={PART_LABELS.month}
          placeholder={PART_PLACEHOLDERS.month}
          value={asText(value.month)}
          options={asOptions(monthChoices())}
          onChange={set('month')}
        />
        <Select
          {...shared}
          aria-label={PART_LABELS.year}
          placeholder={PART_PLACEHOLDERS.year}
          value={asText(value.year)}
          options={asOptions(yearChoices(year, value.year))}
          onChange={set('year')}
        />
      </NoFieldContext>
    </div>
  );
}

export default BirthDatePicker;
```

In `src/admin/ui/styles.ts`, after the line `${R} .ui-fm-title{display:block;margin:4px 0 8px;font-size:15px}` (Task 9), add:

```ts

/* birth date picker: three selects zi / lună / an */
${R} .ui-bdate{display:grid;grid-template-columns:minmax(64px,1fr) minmax(120px,2fr) minmax(84px,1.3fr);gap:var(--ui-space-2)}
```

In `src/admin/ui/index.ts` replace

```ts
export { Field, FieldRow, useFieldControl, type FieldProps, type FieldAria } from './Field';
```

with

```ts
export { Field, FieldRow, NoFieldContext, useFieldControl, type FieldProps, type FieldAria } from './Field';
```

and after the DateInput export add:

```ts
export { BirthDatePicker, type BirthDatePickerProps } from './BirthDatePicker';
export {
  EMPTY_DATE,
  isFullDate,
  partsFromDisplay,
  partsToDisplay,
  partsFromIso,
  partsToIso,
  type DateParts,
} from '../../club/ui-birth-date';
```

- [ ] **Step 6: Run the checks**

Run: `npx vitest run src/club/__tests__/ui-birth-date.test.ts` (PASS, 11 tests), `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`.

- [ ] **Step 7: Commit**

```bash
git add src/club/ui-birth-date.ts src/club/__tests__/ui-birth-date.test.ts src/admin/ui/Field.tsx src/admin/ui/BirthDatePicker.tsx src/admin/ui/styles.ts src/admin/ui/index.ts
git commit -m "feat(admin-ui): birth date picker zi / luna / an"
```

---

### Task 11: UI reference page and docs

**Files:**
- Create: `src/admin/dashboard/ui-reference/Phase3Demos.tsx`
- Modify: `src/admin/dashboard/UiReferencePage.tsx` (imports at line 73; before the InboxLayout `Window`), `docs/admin-ui/PLAN.md` (append)
- Test: none new (Task 12 drives these demos in a browser)

**Interfaces:**
- Consumes: everything above, through `src/admin/ui`.
- Produces: the window "Componente faza 3" on `/admin/plugins/edusport-ui` with labelled demos that Task 12 uses: combobox "Grupa (Select)", "Sezon" (placeholder), "Dezactivat", "Grupa (SearchableSelect)" (grouped), `data-testid="sel-out"`; RadioGroups "Dorește să fie membru" (plain) and "Sportiv" (cards, nothing chosen); button "Toast cu acțiune"; buttons "Panou: meniu" (dropdown), "Panou: fereastră" (Modal on desktop), "Panou: ecran întreg" (full height), each with a Select "Grupa" inside; a FilterPanel over 18 synthetic athletes ("18 sportivi"); two BirthDatePickers ("Data nașterii", and one holding 14.03.1998), `data-testid="bd-out"`.

- [ ] **Step 1: The demos**

`src/admin/dashboard/ui-reference/Phase3Demos.tsx`:

```tsx
import * as React from 'react';
import {
  BirthDatePicker,
  BottomSheet,
  Button,
  EMPTY_DATE,
  Field,
  FieldRow,
  FilterPanel,
  PageHeader,
  RadioGroup,
  SearchableSelect,
  Section,
  Select,
  Window,
  adminToast,
  partsToDisplay,
  type ComboOption,
  type DateParts,
  type FilterSection,
} from '../../ui';

/** Phase 3 shared pieces on the UI reference page (plan 3-1). Synthetic data only. */

const GROUPS = ['Primii Pași', 'Începători', 'Intermediari Bronze', 'Intermediari Silver', 'Avansați Bronze', 'Avansați Silver', 'Avansați Gold'];
const GROUP_OPTIONS = GROUPS.map((g) => ({ value: g, label: g }));
const SEASONS = [
  { value: '2026-2027', label: '2026-2027' },
  { value: '2025-2026', label: '2025-2026' },
];
const GROUPED: ComboOption[] = [
  ...GROUPS.map((g) => ({ value: `s-${g}`, label: g, group: 'Școala de patinaj' })),
  { value: 'c-pro', label: 'Profesioniști', group: 'Club' },
  { value: 'c-av', label: 'Avansați', group: 'Club' },
];

function SelectDemo() {
  const [group, setGroup] = React.useState(GROUPS[0]);
  const [season, setSeason] = React.useState('');
  const [picked, setPicked] = React.useState<string | null>(null);
  return (
    <Section title="Select, SearchableSelect pe secțiuni">
      <FieldRow>
        <Field label="Grupa (Select)">
          <Select value={group} options={GROUP_OPTIONS} onChange={setGroup} />
        </Field>
        <Field label="Sezon">
          <Select value={season} placeholder="Toate sezoanele" options={SEASONS} onChange={setSeason} />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Dezactivat">
          <Select value="2026-2027" options={SEASONS} disabled />
        </Field>
        <Field label="Grupa (SearchableSelect)">
          <SearchableSelect value={picked} onChange={(v) => setPicked(v)} options={GROUPED} placeholder="Fără grupă deocamdată" />
        </Field>
      </FieldRow>
      <p className="ui-muted" data-testid="sel-out">
        Ales: {group}
      </p>
    </Section>
  );
}

function RadioDemo() {
  const [plain, setPlain] = React.useState<'da' | 'nu'>('da');
  const [choice, setChoice] = React.useState<'existent' | 'nou' | null>(null);
  return (
    <Section title="Radio">
      <RadioGroup
        aria-label="Dorește să fie membru"
        value={plain}
        onChange={setPlain}
        options={[
          { value: 'da', label: 'Da' },
          { value: 'nu', label: 'Nu' },
        ]}
      />
      <RadioGroup
        aria-label="Sportiv"
        variant="card"
        value={choice}
        onChange={setChoice}
        options={[
          { value: 'existent', label: 'Sportiv existent', hint: 'Înscrierea se adaugă la această fișă' },
          { value: 'nou', label: 'Sportiv nou', hint: 'Se creează o fișă nouă: Ana Pop' },
        ]}
      />
    </Section>
  );
}

function ToastDemo() {
  const undoable = () =>
    adminToast.success('Înscriere confirmată: Ana Pop', {
      duration: 8000,
      action: { label: 'Anulează', onClick: () => adminToast.info('Confirmare anulată') },
    });
  return (
    <Section title="Toast cu acțiune">
      <div className="ui-ref-row">
        <Button variant="secondary" onClick={undoable}>
          Toast cu acțiune
        </Button>
      </div>
    </Section>
  );
}

function SheetDemo({ label, desktop, fullHeight = false }: { label: string; desktop: 'dropdown' | 'modal'; fullHeight?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [group, setGroup] = React.useState(GROUPS[1]);
  const ref = React.useRef<HTMLButtonElement | null>(null);
  const footer = (
    <>
      <Button variant="secondary" onClick={() => setOpen(false)}>
        Anulează
      </Button>
      <Button onClick={() => setOpen(false)}>Gata</Button>
    </>
  );
  return (
    <>
      <Button ref={ref} variant="secondary" onClick={() => setOpen(!open)}>
        {label}
      </Button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label} desktop={desktop} fullHeight={fullHeight} anchorRef={ref} dropdownWidth={360} footer={footer}>
        <Field label="Grupa">
          <Select value={group} options={GROUP_OPTIONS} onChange={setGroup} />
        </Field>
      </BottomSheet>
    </>
  );
}

interface DemoAthlete {
  section: string;
  group: string;
  acs: string;
  pub: string;
}

const SECTIONS = ['Școala de patinaj', 'Club'];
const ACS = ['Da', 'Nu', 'În așteptare'];
const DEMO: DemoAthlete[] = Array.from({ length: 18 }, (_, i) => ({
  section: SECTIONS[i % 5 === 0 ? 1 : 0],
  group: GROUPS[i % GROUPS.length],
  acs: ACS[i % 3],
  pub: i % 4 === 0 ? 'Public' : 'Ascuns',
}));
const opts = (list: string[]) => list.map((v) => ({ value: v, label: v }));

function FilterDemo() {
  const [picks, setPicks] = React.useState<Record<string, string[]>>({});
  const sections: FilterSection[] = [
    { key: 'section', label: 'Secțiune', options: opts(SECTIONS), selected: picks.section ?? [] },
    { key: 'group', label: 'Grupa', options: opts([...GROUPS, 'Profesioniști', 'Avansați']), selected: picks.group ?? [] },
    { key: 'acs', label: 'Membru A.C.S.', options: opts(ACS), selected: picks.acs ?? [] },
    { key: 'pub', label: 'Profil public', options: opts(['Public', 'Ascuns']), selected: picks.pub ?? [], single: true },
  ];
  const n = DEMO.filter((a) => sections.every((s) => s.selected.length === 0 || s.selected.includes(a[s.key as keyof DemoAthlete]))).length;
  return (
    <Section title="Filtre">
      <FilterPanel
        sections={sections}
        onChange={(key, selected) => setPicks((p) => ({ ...p, [key]: selected }))}
        onClearAll={() => setPicks({})}
        totalLabel={n === 1 ? '1 sportiv' : `${n} sportivi`}
        showLabel={n === 1 ? 'Arată 1 sportiv' : `Arată ${n} sportivi`}
      />
    </Section>
  );
}

function BirthDemo() {
  const [date, setDate] = React.useState<DateParts>(EMPTY_DATE);
  const [old, setOld] = React.useState<DateParts>({ day: 14, month: 3, year: 1998 });
  return (
    <Section title="Data nașterii">
      <FieldRow>
        <Field label="Data nașterii">
          <BirthDatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="Data nașterii (an în afara listei)">
          <BirthDatePicker value={old} onChange={setOld} />
        </Field>
      </FieldRow>
      <p className="ui-muted" data-testid="bd-out">
        {partsToDisplay(date) ?? ''}
      </p>
    </Section>
  );
}

export function Phase3Demos() {
  return (
    <Window>
      <PageHeader title="Componente faza 3" subtitle="Select, Radio, Toast cu acțiune, BottomSheet, Filtre, data nașterii." />
      <div className="ui-body">
        <SelectDemo />
        <RadioDemo />
        <ToastDemo />
        <Section title="BottomSheet">
          <div className="ui-ref-row">
            <SheetDemo label="Panou: meniu" desktop="dropdown" />
            <SheetDemo label="Panou: fereastră" desktop="modal" />
            <SheetDemo label="Panou: ecran întreg" desktop="modal" fullHeight />
          </div>
        </Section>
        <FilterDemo />
        <BirthDemo />
      </div>
    </Window>
  );
}
```

- [ ] **Step 2: Mount them**

In `src/admin/dashboard/UiReferencePage.tsx`, after `import { DASHBOARD_TO } from './menu';` add

```tsx
import { Phase3Demos } from './ui-reference/Phase3Demos';
```

and replace

```tsx
        <Window>
          <PageHeader title="InboxLayout" subtitle="Listă + cititor, cu file și paginare." />
```

with

```tsx
        <Phase3Demos />

        <Window>
          <PageHeader title="InboxLayout" subtitle="Listă + cititor, cu file și paginare." />
```

- [ ] **Step 3: Document the pieces**

Append to `docs/admin-ui/PLAN.md`:

```markdown
## Phase 3 shared pieces (plan 3-1, 2026-10-26)

Built for Înscrieri (3A) and Sportivi (3B); all on the reference page (/admin/plugins/edusport-ui, "Componente faza 3").
- [x] `Select` {value, onChange(value), options?, placeholder?, disabled?, className?, style?, aria-label?}: rewritten as a combobox button with a chevron and the shared list (Popover + ui-opt, selected option ticked); keyboard as a select-only combobox, type-ahead without diacritics. Same props as before, so every page switched at once; no native `<select>` left in src/admin (checked by `src/club/__tests__/admin-select-migration.test.ts`).
- [x] `SearchableSelect`: `ComboOption.group` puts options under a header (group pickers: section name, school first, then Club).
- [x] `Radio` / `RadioGroup` {value | null, onChange, options [{value, label, hint?}], variant plain | card, direction}: native radios with the admin mark; card = the confirm window's choice cards.
- [x] `adminToast.*(text, { action: { label, onClick } })`: one action button (e.g. "Anulează"); runs once, closes the toast; the countdown waits while pointer or focus is on it.
- [x] `BottomSheet`: phone panel from the bottom (85% or `fullHeight`), swipe down / X / overlay / Escape, same layer stack and focus trap as Modal / Drawer, z-index token `sheet` between Drawer and Modal; on wider screens a dropdown under `anchorRef` (arrow, 8px corners) or the Modal (`desktop="modal"`).
- [x] `FilterPanel` (filters-v3): "Filtre" button with the active count; desktop dropdown with sections left and options right (36px rows, search above 8 options, live total, "Șterge tot", "Gata"); phone drill-in sheet ("‹ Filtre", "Arată N ...").
- [x] `BirthDatePicker` {value: DateParts, onChange}: three Selects zi / lună / an, years 25 to 2 years ago plus a stored year outside; helpers partsFrom/ToDisplay (ZZ.LL.AAAA) and partsFrom/ToIso.
- [x] Selected style E (selected-state-v2) on `.ui-inbox-item[aria-current="true"]` and the filter section nav.
- [x] Popover: `arrow` option; nested popovers (a Select inside "Alte filtre" or a filter dropdown) no longer close their parent; Escape closes the newest only.
- [x] New radius tokens `lg` (8px dropdowns), `sheet` (phone sheet top corners), `handle`, `radio`, allowed by `scripts/admin-ui-check.mjs`.
```

- [ ] **Step 4: Run the checks**

Run: `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors), `node scripts/admin-ui-check.mjs --strict` (exit 0).

- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/ui-reference/Phase3Demos.tsx src/admin/dashboard/UiReferencePage.tsx docs/admin-ui/PLAN.md
git commit -m "docs(admin-ui): phase 3 shared pieces on the reference page"
```

---

### Task 12: Build, full checks and browser pass on a throwaway Postgres

**Files:** none in the repo. Temporary files live in `${TMPDIR:-/tmp}/es31` and are removed at the end.

**Interfaces:**
- Consumes: everything above.
- Proves: the admin bundle builds; no native select is left on any page that had one; Select keyboard and type-ahead work; group headers show; a Select inside "Alte filtre" keeps it open; Escape closes a list before its dialog; the undo toast runs once and closes; the filter dropdown (desktop) and the drill-in sheet (phone) work, swipe down and Escape close the sheet; the full-height sheet fills the phone; the birth date picker gives ZZ.LL.AAAA and keeps an old year; nothing is tagged by the SaveBar tagger; no page errors.

If port 55434 or 1340 is taken, pick free ones and change them everywhere below (also `B` in `pass.py`). Start Strapi as a background job and poll `/_health`. Log in once per run (Strapi rate-limits `/admin/login`).

- [ ] **Step 1: Full checks**

```bash
cd /Users/codrin/Documents/Programming/edusport_backend
npm test
npx tsc --noEmit
npx tsc --noEmit -p src/admin/tsconfig.json
node scripts/admin-ui-check.mjs --strict
```

Expected: all tests PASS (the nine new files included), zero type errors in both projects, checker exit 0 with "all 0".

- [ ] **Step 2: Postgres, environment, build**

```bash
T="${TMPDIR:-/tmp}/es31"; mkdir -p "$T/shots"
cat > "$T/env" <<'EOF'
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55434
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
HOST=127.0.0.1
PORT=1340
APP_KEYS=throwawayA,throwawayB
API_TOKEN_SALT=throwaway
ADMIN_JWT_SECRET=throwaway
TRANSFER_TOKEN_SALT=throwaway
JWT_SECRET=throwaway
ENCRYPTION_KEY=throwaway
STRAPI_TELEMETRY_DISABLED=true
EOF
docker run -d --name es31-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi \
  -p 127.0.0.1:55434:5432 postgres:16
until docker exec es31-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
```

Expected: `✔ Building admin panel` (the bundle resolves `../../club/ui-*.ts`).

- [ ] **Step 3: One registration, an admin, Strapi**

```bash
cat > "$T/fixture.js" <<'EOF'
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const cur = await d('api::season.season').create({ data: { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270, isCurrent: true } });
  const school = await d('api::section.section').create({ data: { name: 'Școala de patinaj', kind: 'school', slug: 'afi-cotroceni', publicPage: true, order: 1 } });
  await d('api::section.section').create({ data: { name: 'Club', kind: 'club', slug: 'club', order: 2 } });
  await d('api::registration-submission.registration-submission').create({ data: {
    email: 'maria@example.com', phone: '0722000000', childName: 'Ana Pop', childBirthDate: '02.03.2018', parentName: 'Maria Pop',
    shirtSize: '128', status: 'Nou', season: '2026-2027', seasonRef: cur.documentId, section: school.documentId, registrationNumber: '2026-0001',
    submittedAt: '2026-10-20T10:00:00.000Z', relationship: 'parinte', childHeight: 128, lastSeason: 'Începători', membershipAnswer: 'da',
    subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 590, member: true }, source: 'Facebook',
    gdprConsent: true, regulationsConsent: true, priorExperience: 'Nu este cazul', expectations: 'Să patineze', archived: false,
  } });
  console.log('fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
EOF
(set -a; . "$T/env"; set +a; node -e "$(cat "$T/fixture.js")")
(set -a; . "$T/env"; set +a; npx strapi admin:create-user --email=admin@example.com --password='Throwaway123' --firstname=Admin)
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1340/_health | grep -q 204; do sleep 2; done
```

Expected: `fixture ok`, the admin created, `/_health` answers 204.

- [ ] **Step 4: Browser pass**

Needs Python Playwright with Chromium (`pip install playwright && playwright install chromium`; both are on this machine). If Needs decision 2a chose numbers, change `'martie'` below to `'03'`.

```bash
cat > "$T/pass.py" <<'EOF'
import asyncio, sys
from playwright.async_api import async_playwright

B = 'http://127.0.0.1:1340/admin'
OUT = sys.argv[1]
NATIVE = "document.querySelectorAll('.ui-root select').length"
TAGGED = "document.querySelectorAll('[data-edusport-default-save]').length"
PAGES = ['edusport-ui', 'edusport-inscrieri', 'edusport-voluntari', 'edusport-mesaje', 'edusport-competitii',
         'edusport-membri', 'edusport-sezoane', 'edusport-preturi', 'edusport-regulament', 'edusport-sportivi']

async def login(pg):
    await pg.goto(B + '/auth/login'); await pg.wait_for_timeout(1500)
    await pg.fill('input[name=email]', 'admin@example.com'); await pg.fill('input[name=password]', 'Throwaway123')
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)

async def open_ui(pg):
    await pg.goto(B + '/plugins/edusport-ui'); await pg.wait_for_timeout(3000)

async def pages(pg, r):
    for name in PAGES:
        await pg.goto(f'{B}/plugins/{name}'); await pg.wait_for_timeout(3000)
        r['native_selects'] += await pg.evaluate(NATIVE)
        r['tagged'] += await pg.evaluate(TAGGED)
        await pg.screenshot(path=f'{OUT}/desk-{name}.png', full_page=True)

async def selects(pg, r):
    await open_ui(pg)
    sel = pg.get_by_role('combobox', name='Grupa (Select)')
    await sel.focus()
    for key in ['ArrowDown', 'ArrowDown', 'Enter']:
        await pg.keyboard.press(key)
    r['select_keys'] = await pg.get_by_test_id('sel-out').inner_text()
    await sel.focus(); await pg.keyboard.type('ii', delay=60)
    r['select_typeahead'] = await pg.get_by_test_id('sel-out').inner_text()
    await pg.get_by_role('combobox', name='Grupa (SearchableSelect)').click()
    r['group_headers'] = await pg.locator('.ui-opt-group').all_text_contents()
    await pg.screenshot(path=f'{OUT}/desk-groups.png')
    await pg.keyboard.press('Escape')

async def nesting(pg, r):
    await pg.goto(B + '/plugins/edusport-inscrieri'); await pg.wait_for_timeout(3500)
    await pg.locator('button', has_text='Alte filtre').click()
    await pg.get_by_role('combobox', name='Coloana filtrului').click()
    await pg.get_by_role('option').nth(1).click()
    r['alte_filtre_still_open'] = await pg.locator('.sbt-advpop').is_visible()
    await open_ui(pg)
    await pg.get_by_role('button', name='Panou: fereastră').click()
    dialog = pg.get_by_role('dialog')
    await dialog.get_by_role('combobox', name='Grupa').click()
    await pg.keyboard.press('Escape')
    r['escape_closes_list_only'] = (await pg.get_by_role('listbox').count()) == 0 and await dialog.is_visible()
    await pg.keyboard.press('Escape')
    r['second_escape_closes_dialog'] = (await pg.get_by_role('dialog').count()) == 0

async def toast(pg, r):
    await pg.get_by_role('button', name='Toast cu acțiune').click()
    await pg.locator('.ui-toast').get_by_role('button', name='Anulează').click()
    await pg.wait_for_timeout(400)
    r['toast_undo_ran'] = await pg.locator('.ui-toast', has_text='Confirmare anulată').count()
    r['toast_closed'] = await pg.locator('.ui-toast', has_text='Înscriere confirmată').count() == 0

async def filters(pg, r):
    await pg.locator('.ui-fbtn').click()
    dd = pg.locator('.ui-sheetdd')
    r['total_before'] = await dd.locator('.ui-ff-total').inner_text()
    await dd.locator('.ui-fnav-item', has_text='Grupa').click()
    r['grupa_search_box'] = await dd.locator('.ui-fopts-search').count()
    await dd.get_by_label('Începători').check()
    r['total_after'] = await dd.locator('.ui-ff-total').inner_text()
    await pg.screenshot(path=f'{OUT}/desk-filters.png')
    await dd.get_by_role('button', name='Gata').click()
    r['focus_back_on_filtre'] = await pg.evaluate("document.activeElement.classList.contains('ui-fbtn')")

async def birth(pg, r):
    for name, option in [('Zi', '14'), ('Lună', 'martie'), ('An', '2016')]:
        await pg.get_by_role('combobox', name=name, exact=True).first.click()
        await pg.get_by_role('option', name=option, exact=True).click()
    r['birth_date'] = await pg.get_by_test_id('bd-out').inner_text()
    await pg.get_by_role('combobox', name='An', exact=True).nth(1).click()
    r['old_year_listed'] = await pg.get_by_role('option', name='1998', exact=True).count()
    await pg.keyboard.press('Escape')

async def phone(b, r):
    pg = await b.new_page(viewport={'width': 390, 'height': 844})
    await login(pg); await open_ui(pg)
    await pg.locator('.ui-fbtn').click()
    sheet = pg.locator('.ui-sheet')
    await pg.screenshot(path=f'{OUT}/phone-filters.png')
    r['phone_show_label'] = await sheet.locator('.ui-ff-show').inner_text()
    await sheet.locator('.ui-fm-row', has_text='Grupa').click()
    await pg.screenshot(path=f'{OUT}/phone-filters-grupa.png')
    r['phone_back'] = await sheet.locator('.ui-fback').inner_text()
    await sheet.locator('.ui-fback').click()
    await pg.keyboard.press('Escape')
    r['phone_escape_closes'] = (await pg.locator('.ui-sheet').count()) == 0
    await pg.locator('.ui-fbtn').click()
    head = await pg.locator('.ui-sheet-h').bounding_box()
    x, y = head['x'] + head['width'] / 2, head['y'] + 6
    await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x, y + 220, steps=8); await pg.mouse.up()
    await pg.wait_for_timeout(300)
    r['phone_swipe_closes'] = (await pg.locator('.ui-sheet').count()) == 0
    await pg.get_by_role('button', name='Panou: ecran întreg').click()
    box = await pg.locator('.ui-sheet--full').bounding_box()
    r['phone_full_height'] = round(box['height'])
    await pg.screenshot(path=f'{OUT}/phone-full.png')
    r['tagged'] += await pg.evaluate(TAGGED)
    await pg.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1400, 'height': 1000})
        r = {'native_selects': 0, 'tagged': 0, 'page_errors': []}
        pg.on('pageerror', lambda e: r['page_errors'].append(str(e)))
        await login(pg)
        await pages(pg, r)
        await selects(pg, r)
        await nesting(pg, r)
        await toast(pg, r)
        await filters(pg, r)
        await birth(pg, r)
        await phone(b, r)
        for k, v in r.items():
            print(f'{k}: {v}')
        await b.close()

asyncio.run(main())
EOF
python3 "$T/pass.py" "$T/shots"
```

Expected output:

```
native_selects: 0
tagged: 0
page_errors: []
select_keys: Ales: Începători
select_typeahead: Ales: Intermediari Silver
group_headers: ['Școala de patinaj', 'Club']
alte_filtre_still_open: True
escape_closes_list_only: True
second_escape_closes_dialog: True
toast_undo_ran: 1
toast_closed: True
total_before: 18 sportivi
grupa_search_box: 1
total_after: 3 sportivi
focus_back_on_filtre: True
birth_date: 14.03.2016
old_year_listed: 1
phone_show_label: Arată 18 sportivi
phone_back: Filtre
phone_escape_closes: True
phone_swipe_closes: True
phone_full_height: 844
```

(`select_typeahead`: the first "i" jumps from "Începători" to "Intermediari Bronze", the second, within half a second, cycles to "Intermediari Silver".)

- [ ] **Step 5: Look at the renders**

Open the screenshots in `$T/shots` and compare them with the approved screens: the Select (open-questions-v2, question 8, "Propus"), the filter dropdown (filters-v3 "Calculator") and the phone sheets (filters-v3 "Telefon", bottom-sheet-v1 "Pe telefon"), the choice cards (prototype v5 confirm window), the inbox selection (selected-state-v2 option E, open `/plugins/edusport-mesaje` with a message if one exists), and every page of `PAGES` with its selects. Show them to the user in the companion (DECISIONS phase3ab: renders are reviewed after implementation; fixes go into the owning task's files with a `fix(admin-ui): ...` commit).

- [ ] **Step 6: Clean up**

```bash
kill "$(cat "$T/pid")"
docker rm -f es31-pg
rm -rf "$T"
```

Expected: container removed. No commit in this task unless a check failed.

---

## Interfaces for other plans

All from `src/admin/ui` (`import { ... } from '../ui'` or `'../../ui'`). The rules modules are importable from `src/club/ui-*.ts` too (server and tests).

**Select** (rewritten; same call shape as before):

```ts
interface SelectOption { value: string; label: string; disabled?: boolean }
interface SelectProps extends FieldAria /* id?, required?, 'aria-describedby'?, 'aria-invalid'? */ {
  value: string;                        // '' = nothing chosen (shows the placeholder row, or blank)
  onChange?: (value: string) => void;   // only for a different value
  options?: SelectOption[];
  placeholder?: string;                 // first row, value '' (picking it clears)
  disabled?: boolean;
  className?: string;                   // on the button (also `ui-input ui-sel`)
  style?: React.CSSProperties;          // on the button
  'aria-label'?: string;
}
const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLButtonElement>>;
```

Use it for short fixed lists: the Înscrieri status menu ("Nou", "Contactat", "Respins", spec 3.3), the "Sportiv existent: Da / Nu" toolbar filter (3.1), the school picker of "Mută la altă școală" (3.6), the Sportivi season selector (5). Inside a `Field` it takes the label. No `children`, no event argument.

**SearchableSelect** (existing) with groups:

```ts
interface ComboOption { value: string; label: string; hint?: string; disabled?: boolean; group?: string }
```

Group picker of the confirm window (4.3): pass the school's groups with `group: '<school section name>'`, then the Club groups with `group: 'Club'`, each in the groups' own order, `placeholder: 'Fără grupă deocamdată'`. A header row shows before each group; keep options of one group together.

**RadioGroup / Radio:**

```ts
interface RadioOption<V extends string = string> { value: V; label: React.ReactNode; hint?: React.ReactNode; disabled?: boolean }
interface RadioGroupProps<V extends string = string> {
  value: V | null;                      // null = nothing chosen ("Probabil": no preselection, 4.1)
  onChange: (value: V) => void;
  options: RadioOption<V>[];
  variant?: 'plain' | 'card';           // card = prototype v5 choice cards, two side by side, stacked on phones
  direction?: 'row' | 'column';         // default 'row'
  name?: string; disabled?: boolean; className?: string;
  'aria-label'?: string; 'aria-labelledby'?: string;
}
function RadioGroup<V extends string = string>(props: RadioGroupProps<V>): JSX.Element;
interface RadioProps { name: string; value: string; checked: boolean; onChange: () => void; label: React.ReactNode; hint?: React.ReactNode; disabled?: boolean; card?: boolean; className?: string }
function Radio(props: RadioProps): JSX.Element;
```

Confirm window (4.1): `variant="card"`, options "Sportiv existent" (hint "Înscrierea se adaugă la această fișă", plus the "În formular: nu a participat sezonul trecut." line as a second hint line) and "Sportiv nou" (hint "Se creează o fișă nouă: <nume>"); `value` = 'existent' only for Sigur.

**Toast action:**

```ts
interface ToastAction { label: string; onClick: () => void }
interface ToastOptions { title?: React.ReactNode; duration?: number; action?: ToastAction }
adminToast.success(text: React.ReactNode, opts?: ToastOptions): number;   // also info / warning / warn / error
```

Undo after confirming (4.6): `adminToast.success(\`Înscriere confirmată: ${name}\`, { duration: 8000, action: { label: 'Anulează', onClick: undo } })`. The click runs `onClick` once and closes the toast; `undo` reports its own result (another toast).

**BottomSheet:**

```ts
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;                  // X, overlay, swipe down, Escape; outside click on the dropdown
  title: React.ReactNode;               // phone header and Modal title; a node is fine (back link)
  ariaLabel?: string;                   // name when title is not plain text; names the dropdown
  children?: React.ReactNode;
  footer?: React.ReactNode;             // sticky footer on phones; buttons share the row (flex 1), 40px high
  fullHeight?: boolean;                 // phones: full screen height (confirm window 4.8, record 6.1)
  desktop?: 'dropdown' | 'modal';       // wider screens; default 'dropdown' (needs anchorRef), else the Modal
  anchorRef?: React.RefObject<HTMLElement | null>;
  dropdownWidth?: number;
  modalSize?: 'sm' | 'md' | 'lg';
  dismissable?: boolean;                // false blocks every close request (request running)
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string; bodyClassName?: string;
}
function BottomSheet(props: BottomSheetProps): JSX.Element | null;
function useIsPhone(): boolean;                 // max-width 640px
function useMediaQuery(query: string): boolean;
const PHONE_QUERY = '(max-width: 640px)';
```

Confirm window: `<BottomSheet desktop="modal" modalSize="md" fullHeight title={\`Confirmă înscrierea ${nr}\`} footer={...}>`; on desktop that is the Modal, on phones the full-height sheet. Athlete record on phones (6.1): render the page normally on desktop and `{useIsPhone() && <BottomSheet open fullHeight ...>}` on phones, with the scrolling Tabs in the body and "Salvează" in `footer` (the sheet carries `.ui-root`, so the SaveBar tagger leaves it alone). A ConfirmDialog opened from a sheet sits above it (z-index `sheet` < `modal`).

**FilterPanel (filters-v3):**

```ts
interface FilterChoice { value: string; label: string }
interface FilterSection {
  key: string;
  label: string;                        // "Secțiune", "Grupa", "Membru A.C.S.", ...
  options: FilterChoice[];
  selected: string[];                   // [] = "Toate"
  single?: boolean;                     // radio rows (e.g. "Profil public", a sort section); default checkbox rows
  summary?: string;                     // text under the name; default "Toate" or the chosen labels
}
interface FilterPanelProps {
  sections: FilterSection[];
  onChange: (key: string, selected: string[]) => void;   // apply at once
  onClearAll: () => void;                                 // "Șterge tot"
  totalLabel: string;                                     // desktop footer, e.g. "218 sportivi"
  showLabel: string;                                      // phone footer, e.g. "Arată 218 sportivi" / "Arată 1 sportiv"
  buttonLabel?: string;                                   // default "Filtre"
  className?: string;
}
function FilterPanel(props: FilterPanelProps): JSX.Element;
function sectionSummary(s: { options: FilterChoice[]; selected: string[]; summary?: string }): string;
function activeSections(sections: ReadonlyArray<{ selected: string[] }>): number;
const ALL_LABEL = 'Toate';
```

The caller owns the filter state and the counts (server-side for Sportivi), the plural forms of its nouns, and what "Șterge tot" resets. Sportivi (5): sections Secțiune, Grupa, Fără grupă, Membru A.C.S., Profil public, Date, Status, Posibile dubluri; a section with more than 8 options gets a search box by itself. Înscrieri keeps its current toolbar (gaps #22) and does not use FilterPanel.

**BirthDatePicker:**

```ts
interface DateParts { day: number | null; month: number | null; year: number | null }
const EMPTY_DATE: DateParts;
interface BirthDatePickerProps extends FieldAria {
  value: DateParts;
  onChange: (next: DateParts) => void;
  today?: Date;                         // year range anchor, default now
  disabled?: boolean;
  className?: string;
}
function BirthDatePicker(props: BirthDatePickerProps): JSX.Element;
function partsFromDisplay(text: string | null | undefined): DateParts | null;  // "14.03.2016"
function partsToDisplay(p: DateParts): string | null;                         // -> "14.03.2016" or null if incomplete / impossible
function partsFromIso(iso: string | null | undefined): DateParts | null;      // "2016-03-14"
function partsToIso(p: DateParts): string | null;
function isFullDate(p: DateParts): boolean;
```

Înscrieri Editează (3.4): `value = partsFromDisplay(normalised) ?? EMPTY_DATE`, where `normalised` is the stored `childBirthDate` turned into ZZ.LL.AAAA by the registration date reader of the 3A data plan (old free-text forms, spec 1.3); save `partsToDisplay(parts)`. Athlete Date tab (6.2): `partsFromIso(athlete.birthDate)` / `partsToIso(parts)`. A stored year outside 25 to 2 years ago stays in the list. Error copy for a missing or incomplete date in the admin is not decided by the spec (the website's is "Alegeți data nașterii."); the calling plan asks.

**Also:** `NoFieldContext` (renders children outside the enclosing Field), `Popover` prop `arrow`, tokens `radius.lg | sheet | handle | radio` and `zIndex.sheet`, icons `IconChevronLeft`, `IconChevronRight`, `IconCheck` (from `./icons` inside `src/admin/ui`), selected style E on any `.ui-inbox-item[aria-current="true"]`. Reused unchanged: `Drawer`, `Modal`, `ConfirmDialog` (`src/admin/ConfirmDialog.tsx`), `Tabs` (scrolls sideways on phones already), `HelpTip`, `Notice`, `MenuButton` (exported from `src/admin/dashboard/SubmissionTable.tsx`, for "..." menus).

## Notes for other plans

- **Înscrieri UI plan:** `src/admin/dashboard/inscrieri/EditableAnswer.tsx` (two Select call sites) goes away with Editează (3.3); nothing here depends on it. Existing copy with an em dash stays as it is here and is yours to replace: the `SeasonSelect` placeholder `'— fără sezon —'` (`SubmissionTable.tsx:386`) and `extraValueText`'s `'—'` for empty values (`SubmissionTable.tsx:338`, spec copy rule: empty values blank).
- **Sportivi UI plan:** `SportiviPage.tsx` and `SportivEditPage.tsx` keep working on the new Select until you replace or move them. Count texts ("<n> sportivi", "Arată N sportivi", singular forms, and the Romanian "de" from 20 on, e.g. "20 de sportivi") are passed in by you; FilterPanel prints them as given.
- **Website plan (spec 9):** Needs decision 2 (labels, order, empty row, impossible dates) applies to the website picker too, so both pickers stay "the same three selects and year range" (spec 3.4).

## Self-review

- **Spec coverage (section 8 and every use):** custom Select admin-wide, every page at once: Tasks 2, 3 (36 call sites listed, scan test, browser pass over the pages). Radio: Task 5 (plain and the 4.1 choice cards, 4.8 stacked on phones). Toast `action` "Anulează": Task 6 (4.6). BottomSheet: Task 7 (phone, dropdown, Modal, full height for 4.8 and 6.1). Filters-v3 layout: Task 9 (desktop and phone, "Arată N", live total, "Șterge tot", "Gata", search above 8). Selected style E: Task 8 (inbox) and Task 9 (filter nav). Birth date picker: Task 10 (3.4, 6.2; year range of 9; stored year kept). SearchableSelect for group pickers listed under section names: Task 4 (4.3). Drawer, Modal, ConfirmDialog reused: BottomSheet builds on Modal and the layer stack. Reference page: Task 11. Phone width: every piece has its phone layout, checked in Task 12.
- **Placeholder scan:** no "TBD" or "similar to"; option B of each Needs decision item names the exact lines that change.
- **Type consistency:** `FilterChoice`, `FilterSectionState`, `FilterSection`, `DateParts`, `PartChoice`, `ToastAction`, `BottomSheetProps`, `SelectProps`, `RadioGroupProps` are spelled the same in the tasks, the tests and "Interfaces for other plans"; `useIsPhone` / `PHONE_QUERY` match Task 1.
- **Review Focus:** each line has its test in the owning task (Tasks 1, 2, 6, 10) and its run-time check in Task 12.

