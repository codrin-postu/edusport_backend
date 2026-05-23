import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { StrapiApp } from '@strapi/strapi/admin';
import componentPreview from '../plugins/component-preview/admin/src';
import { MobileNav } from './MobileNav';
import { SaveBar } from './SaveBar';
import { BlocksToolbarExtra } from './BlocksToolbarExtra';
import roTranslations from './translations/ro.json';

const SIDEBAR_DATA_ATTR = 'data-edusport-sidebar';
const SUBNAV_DATA_ATTR = 'data-edusport-subnav';
const SUBNAV_PARENT_DATA_ATTR = 'data-edusport-subnav-parent';
const DEFAULT_SAVE_ATTR = 'data-edusport-default-save';
const DEFAULT_PREVIEW_ATTR = 'data-edusport-default-preview';
const DEFAULT_PUBLISH_ATTR = 'data-edusport-default-publish';
const DEFAULT_UNPUBLISH_ATTR = 'data-edusport-default-unpublish';
const DEFAULT_SAVE_CARD_ATTR = 'data-edusport-default-save-card';
const DEFAULT_PREVIEW_CARD_ATTR = 'data-edusport-default-preview-card';
const DEFAULT_PUBLISH_CARD_ATTR = 'data-edusport-default-publish-card';
const DEFAULT_UNPUBLISH_CARD_ATTR = 'data-edusport-default-unpublish-card';
const RIGHT_RAIL_ATTR = 'data-edusport-right-rail';
const RIGHT_RAIL_GRID_ATTR = 'data-edusport-right-rail-grid';
const FORM_COLUMN_ATTR = 'data-edusport-form-column';
const SAVEBAR_ROOT_SELECTOR = '#edusport-savebar-root';

// Accessible-name allowlist for Strapi's default action buttons (Save,
// Preview, Publish, Unpublish). Match case-insensitively + word-bounded.
const SAVE_LABELS = ['save', 'salvează', 'salveaza'];
const PREVIEW_LABELS = ['preview', 'previzualizare', 'previzualizează'];
const PUBLISH_LABELS = ['publish', 'publică', 'publica'];
const UNPUBLISH_LABELS = ['unpublish', 'retrage publicarea', 'retrage'];

const GLOBAL_CSS = `
/* Strapi v5 wraps each document action in a labeled card (heading + button).
   We need to hide the WHOLE CARD, not just the inner button, otherwise the
   "Save" / "Preview" label stays visible with an empty body. The card itself
   is detected by walking up from the tagged button to the nearest ancestor
   that owns a matching heading, then stamped with *-CARD-ATTR. */
[${DEFAULT_SAVE_CARD_ATTR}],
[${DEFAULT_PREVIEW_CARD_ATTR}],
[${DEFAULT_PUBLISH_CARD_ATTR}],
[${DEFAULT_UNPUBLISH_CARD_ATTR}] {
  display: none !important;
}

/* Hide the entire right rail (the aside containing "Entry", action cards,
   etc.) and reclaim its column so the form fills the freed width. We collapse
   the wrapping grid to display:block so any sibling column constraint goes
   away entirely, then force the form column and its containers to take full
   width regardless of how Strapi sized them. */
[${RIGHT_RAIL_ATTR}] {
  display: none !important;
}
[${RIGHT_RAIL_GRID_ATTR}] {
  display: block !important;
  grid-template-columns: 1fr !important;
  grid-template-areas: none !important;
}
[${FORM_COLUMN_ATTR}],
[${FORM_COLUMN_ATTR}] > div,
[${FORM_COLUMN_ATTR}] > section,
[${FORM_COLUMN_ATTR}] > form,
[${FORM_COLUMN_ATTR}] form {
  width: 100% !important;
  max-width: none !important;
  flex: 1 1 100% !important;
  grid-column: 1 / -1 !important;
}

/* The underlying Save button stays in the DOM but visually hidden so the
   contextual <SaveBar /> can still forward .click() to submit. The card
   rule above usually hides it as part of the card, but this is a belt-and-
   braces guarantee in case the card walk misses one level. */
[${DEFAULT_SAVE_ATTR}],
[${DEFAULT_PUBLISH_ATTR}],
[${DEFAULT_UNPUBLISH_ATTR}] {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}
[${DEFAULT_PREVIEW_ATTR}] {
  display: none !important;
}
`;

const MOBILE_OVERRIDES_CSS = `
@media (max-width: 640px) {
  /* (1) Hide Strapi's main navigation sidebar - replaced by our MobileNav burger.
     Targeted via a runtime-set data attribute so we don't depend on
     styled-components hash class names that change between Strapi versions. */
  nav[${SIDEBAR_DATA_ATTR}] {
    display: none !important;
  }

  /* (2) Strapi's secondary panel (Content Manager / Settings sub-nav) renders
     as a sticky <nav> beside the main content. On mobile we stack it above
     the content at full width, letting it grow to fit its full list - the
     page itself scrolls. */
  [${SUBNAV_DATA_ATTR}] {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    position: static !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    border-right: none !important;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
  }
  /* Force the SubNav's parent flex container to stack instead of laying out
     row-wise, so the main content drops below the sub-menu. */
  [${SUBNAV_PARENT_DATA_ATTR}] {
    flex-direction: column !important;
    flex-wrap: nowrap !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  /* (3) Pad the page so our fixed burger button (top-right, 38px) doesn't
     overlap headers */
  main,
  [role="main"] {
    padding-top: 56px !important;
  }
}
`;

const STYLE_TAG_ID = 'edusport-mobile-overrides';
const GLOBAL_STYLE_TAG_ID = 'edusport-global';
const NAV_ROOT_ID = 'edusport-mobile-nav-root';
const SAVEBAR_ROOT_ID = 'edusport-savebar-root';
const BLOCKS_TOOLBAR_EXTRA_ROOT_ID = 'edusport-blocks-toolbar-extra-root';

function injectGlobalStyles() {
  if (document.getElementById(GLOBAL_STYLE_TAG_ID)) return;
  const style = document.createElement('style');
  style.id = GLOBAL_STYLE_TAG_ID;
  style.textContent = GLOBAL_CSS;
  document.head.appendChild(style);
}

function injectMobileStyles() {
  if (document.getElementById(STYLE_TAG_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_TAG_ID;
  style.textContent = MOBILE_OVERRIDES_CSS;
  document.head.appendChild(style);
}

/**
 * Strapi v5 admin layout has two sticky `<nav>` panels we need to distinguish:
 *
 *   1. The MainNav - top-level navigation (Home, Content Manager, Settings…).
 *      Always the FIRST sticky-tall `<nav>` in document order.
 *      Hidden on mobile, replaced by our burger.
 *
 *   2. The SubNav (Strapi DS) - rendered by Content Manager / Settings as
 *      `<nav aria-label="…">` with `position: sticky; height: 100vh`. Always
 *      appears AFTER the MainNav in DOM order. On mobile we stack it above
 *      the main content (full-width, capped height) instead of beside it.
 *
 * Both are styled-component renderings whose class names are unstable across
 * versions. We detect structurally (sticky + tall height) and disambiguate by
 * document order, then tag with data attributes the CSS hooks into.
 */
function tagAdminShellReliably() {
  const findStickyTallNavs = (): HTMLElement[] => {
    const all = Array.from(document.querySelectorAll('nav')) as HTMLElement[];
    return all.filter((nav) => {
      const cs = window.getComputedStyle(nav);
      if (cs.position !== 'sticky' && cs.position !== 'fixed') return false;
      // Use offsetHeight so we don't get fooled by elements briefly at 0 - sticky
      // elements still report their laid-out height even when scrolled.
      const h = nav.offsetHeight;
      if (h < window.innerHeight * 0.5) return false;
      return true;
    });
  };

  const tagAll = () => {
    const navs = findStickyTallNavs();
    navs.forEach((nav, idx) => {
      if (idx === 0) {
        // First sticky-tall nav = MainNav. Clear any stale subnav tagging on it
        // (could happen if it was tagged before another nav appeared earlier).
        if (nav.hasAttribute(SUBNAV_DATA_ATTR)) {
          nav.removeAttribute(SUBNAV_DATA_ATTR);
        }
        if (!nav.hasAttribute(SIDEBAR_DATA_ATTR)) {
          nav.setAttribute(SIDEBAR_DATA_ATTR, 'true');
        }
      } else {
        // Any subsequent sticky-tall nav = SubNav.
        if (nav.hasAttribute(SIDEBAR_DATA_ATTR)) {
          // Was wrongly tagged as sidebar earlier (e.g., it was the only one
          // visible at that moment); demote it to subnav now that we have both.
          nav.removeAttribute(SIDEBAR_DATA_ATTR);
        }
        if (!nav.hasAttribute(SUBNAV_DATA_ATTR)) {
          nav.setAttribute(SUBNAV_DATA_ATTR, 'true');
        }
        const parent = nav.parentElement;
        if (parent && !parent.hasAttribute(SUBNAV_PARENT_DATA_ATTR)) {
          parent.setAttribute(SUBNAV_PARENT_DATA_ATTR, 'true');
        }
      }
    });
  };

  // tagAll() reads computed style + offsetHeight, which forces a synchronous
  // layout flush. We must NEVER call it directly from a MutationObserver - every
  // DOM update inside the admin app would thrash layout. Instead, batch through
  // rAF so at most one tagAll runs per frame, and bail out completely for
  // mutations that don't add/remove any <nav> (the common case during edit-form
  // re-renders).
  let scheduled = false;
  const scheduleTagAll = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      tagAll();
    });
  };

  const containsNav = (node: Node): boolean => {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node as Element;
    if (el.tagName === 'NAV') return true;
    return el.querySelector?.('nav') != null;
  };

  // Initial pass + ~6s burst for layout settle, then MutationObserver forever.
  tagAll();
  let attempts = 0;
  const interval = window.setInterval(() => {
    tagAll();
    attempts += 1;
    if (attempts >= 20) window.clearInterval(interval);
  }, 300);

  const observer = new MutationObserver((records) => {
    // Most admin DOM mutations are inside the edit form and don't touch <nav>.
    // Skip them entirely so we don't pay the layout-flush cost.
    for (const r of records) {
      for (const n of Array.from(r.addedNodes)) {
        if (containsNav(n)) {
          scheduleTagAll();
          return;
        }
      }
      for (const n of Array.from(r.removedNodes)) {
        if (containsNav(n)) {
          scheduleTagAll();
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Also rerun on viewport changes - when the user resizes from desktop to
  // mobile, the layout may collapse a previously-second `<nav>` into the only
  // visible one, and we need to re-evaluate which is the MainNav.
  window.addEventListener('resize', scheduleTagAll);
}

function mountMobileNav() {
  if (document.getElementById(NAV_ROOT_ID)) return;
  const root = document.createElement('div');
  root.id = NAV_ROOT_ID;
  document.body.appendChild(root);
  createRoot(root).render(<MobileNav />);
}

function mountSaveBar() {
  if (document.getElementById(SAVEBAR_ROOT_ID)) return;
  const root = document.createElement('div');
  root.id = SAVEBAR_ROOT_ID;
  document.body.appendChild(root);
  createRoot(root).render(<SaveBar />);
}

function mountBlocksToolbarExtra() {
  if (document.getElementById(BLOCKS_TOOLBAR_EXTRA_ROOT_ID)) return;
  const root = document.createElement('div');
  root.id = BLOCKS_TOOLBAR_EXTRA_ROOT_ID;
  // Hidden anchor — the actual UI portals INTO Strapi's toolbar element.
  root.style.display = 'none';
  document.body.appendChild(root);
  createRoot(root).render(<BlocksToolbarExtra />);
}

/**
 * Tag Strapi's default Save button and Preview link so our CSS can hide them
 * and (for Save) so <SaveBar /> can fall back to .click() on the original.
 *
 * Strapi v5 doesn't expose stable class names for these controls, but it
 * does guarantee:
 *   - The Save action renders as <button type="submit"> with accessible
 *     text matching SAVE_LABELS in the current locale.
 *   - The Preview action renders as an <a> with text matching PREVIEW_LABELS
 *     (or with an href containing "/preview").
 *
 * We match by accessible name with a small locale allowlist; the structural
 * `type=submit` constraint guards against false positives (e.g. body text
 * that happens to contain the word "Save").
 *
 * Tagging is idempotent and re-runs on every DOM mutation that adds/removes
 * elements containing a button or an anchor — sharing the same rAF batch as
 * the existing nav tagger.
 */
function getAccessibleName(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim().toLowerCase();
  return (el.textContent ?? '').trim().toLowerCase();
}

function nameMatchesAny(name: string, allowlist: string[]): boolean {
  if (!name) return false;
  // Word-boundary-ish match to avoid catching e.g. "saved" inside a tooltip.
  return allowlist.some((needle) => {
    if (!name.includes(needle)) return false;
    // Reject if "needle" is only a substring of a larger word — require exact
    // token or terminal match. Examples:
    //   "save"   in "save"           ✓
    //   "save"   in "save changes"   ✓
    //   "save"   in "saved"          ✗
    //   "save"   in "unsaved"        ✗
    const re = new RegExp(`(^|[^a-zăâîșțéè])${escapeRegex(needle)}([^a-zăâîșțéè]|$)`, 'iu');
    return re.test(name);
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Walk up from `el` looking for the nearest ancestor that visually represents
 * the "card" wrapping this action — heuristically, the closest ancestor that
 * contains both `el` and a heading (h2…h6) whose text matches `labels`.
 * Falls back to the closest `[role="region"]` / `<section>` / `<aside>` parent
 * that ALSO contains a matching heading. Returns null if no card is found
 * within 6 levels (so we don't accidentally hide the whole right rail).
 */
function findActionCard(el: Element, labels: string[]): Element | null {
  let cursor: Element | null = el.parentElement;
  let depth = 0;
  while (cursor && depth < 6) {
    const heading = cursor.querySelector('h2, h3, h4, h5, h6, [role="heading"]');
    if (heading) {
      const headingName = (heading.textContent ?? '').trim().toLowerCase();
      if (nameMatchesAny(headingName, labels)) return cursor;
    }
    cursor = cursor.parentElement;
    depth++;
  }
  return null;
}

function isInsideSaveBar(el: Element): boolean {
  return el.closest(SAVEBAR_ROOT_SELECTOR) != null;
}

/**
 * True when `el` lives inside a Radix popover, dropdown, dialog, or any
 * other floating overlay container. Used to keep our action-button taggers
 * focused on the page's rail-level controls — never on contextual buttons
 * inside an inline popover (e.g. the Blocks editor's "Insert link" popover
 * has a Save button that would otherwise get caught by the rail-Save
 * matcher and hidden).
 *
 * Selectors cover Radix's portal wrappers and ARIA roles. Adding new ones
 * here protects every tagger in one place.
 */
function isInsidePopover(el: Element): boolean {
  return el.closest(
    '[data-radix-popper-content-wrapper],' +
      '[data-radix-portal],' +
      '[role="dialog"],' +
      '[role="menu"],' +
      '[role="listbox"],' +
      '[role="tooltip"]',
  ) != null;
}

/**
 * Find and tag Strapi's edit-view right rail (an <aside> next to the form).
 * Two detection strategies, in order:
 *   1. The closest <aside> ancestor of a tagged Save button — definitive when
 *      Save has already been tagged.
 *   2. Any <aside> directly inside <main> on a Content Manager edit URL —
 *      catches the case where the rail is up before Save is tagged.
 * The rail's grid parent is also tagged so we can collapse its empty column.
 */
function tagRightRail(): void {
  const candidates = new Set<HTMLElement>();

  // Strategy 1: ancestor of tagged Save button.
  const tagged = document.querySelector<HTMLElement>(`[${DEFAULT_SAVE_ATTR}]`);
  if (tagged) {
    const aside = tagged.closest('aside');
    if (aside) candidates.add(aside);
  }

  // Strategy 2: <aside> inside <main>.
  const mainEl = document.querySelector('main');
  if (mainEl) {
    mainEl.querySelectorAll('aside').forEach((a) => candidates.add(a as HTMLElement));
  }

  candidates.forEach((aside) => {
    if (!aside.hasAttribute(RIGHT_RAIL_ATTR)) {
      aside.setAttribute(RIGHT_RAIL_ATTR, 'true');
    }

    // Walk up from the rail looking for the nearest CSS grid/flex ancestor
    // INSIDE <main> — that's the actual two-column edit-view layout. We stop
    // at <main> so we never cross into page chrome (where the Content Manager
    // sub-nav lives as a sibling of the main area).
    let cursor: HTMLElement | null = aside.parentElement;
    let gridFound = false;
    let depth = 0;
    while (cursor && depth < 6) {
      // Hard boundary: never tag <main> itself or anything above it.
      if (cursor.tagName === 'MAIN') break;

      const cs = window.getComputedStyle(cursor);
      const isGrid = cs.display === 'grid' || cs.display === 'inline-grid';
      const isFlex = cs.display === 'flex' || cs.display === 'inline-flex';

      if (isGrid && !gridFound) {
        cursor.setAttribute(RIGHT_RAIL_GRID_ATTR, 'true');
        gridFound = true;
      }

      if (isGrid || isFlex || cursor === aside.parentElement) {
        Array.from(cursor.children).forEach((child) => {
          if (child === aside) return;
          if (child.contains(aside)) return; // ancestor of aside — skip
          // Never tag <nav> or anything containing a <nav> — those are
          // page-chrome elements (Content Manager sub-nav, etc.) that
          // must keep their original sizing.
          if (child.tagName === 'NAV') return;
          if (child.querySelector?.('nav')) return;
          if (!child.hasAttribute(FORM_COLUMN_ATTR)) {
            child.setAttribute(FORM_COLUMN_ATTR, 'true');
          }
        });
      }

      if (gridFound) break;
      cursor = cursor.parentElement;
      depth++;
    }
  });
}

function tagDefaultSaveAndPreview(): void {
  // For each interactive button we need to identify the action it represents
  // (Save / Publish / Unpublish) and stamp it with the appropriate data
  // attribute. Tagging is exclusive — a button is at most one of these — and
  // we use word-bounded name matching so "Unpublish" doesn't accidentally
  // hit the "Publish" allowlist.
  const buttons = document.querySelectorAll<HTMLButtonElement>('button');
  buttons.forEach((btn) => {
    if (isInsideSaveBar(btn)) return;
    if (isInsidePopover(btn)) return; // skip contextual Save/Publish buttons inside dialogs/popovers
    const name = getAccessibleName(btn);
    // Check Unpublish FIRST because "Unpublish" contains "publish" — we
    // never want a Publish tag on the Unpublish button.
    if (
      !btn.hasAttribute(DEFAULT_UNPUBLISH_ATTR) &&
      nameMatchesAny(name, UNPUBLISH_LABELS)
    ) {
      btn.setAttribute(DEFAULT_UNPUBLISH_ATTR, 'true');
      const card = findActionCard(btn, UNPUBLISH_LABELS);
      if (card && !card.hasAttribute(DEFAULT_UNPUBLISH_CARD_ATTR)) {
        card.setAttribute(DEFAULT_UNPUBLISH_CARD_ATTR, 'true');
      }
      return;
    }
    if (
      !btn.hasAttribute(DEFAULT_PUBLISH_ATTR) &&
      nameMatchesAny(name, PUBLISH_LABELS)
    ) {
      btn.setAttribute(DEFAULT_PUBLISH_ATTR, 'true');
      const card = findActionCard(btn, PUBLISH_LABELS);
      if (card && !card.hasAttribute(DEFAULT_PUBLISH_CARD_ATTR)) {
        card.setAttribute(DEFAULT_PUBLISH_CARD_ATTR, 'true');
      }
      return;
    }
    if (
      !btn.hasAttribute(DEFAULT_SAVE_ATTR) &&
      nameMatchesAny(name, SAVE_LABELS)
    ) {
      btn.setAttribute(DEFAULT_SAVE_ATTR, 'true');
      const card = findActionCard(btn, SAVE_LABELS);
      if (card && !card.hasAttribute(DEFAULT_SAVE_CARD_ATTR)) {
        card.setAttribute(DEFAULT_SAVE_CARD_ATTR, 'true');
      }
    }
  });

  // Preview: Strapi v5 renders the side-panel preview button as a React
  // Router <Link to="preview"> nested inside a Button — at the DOM level
  // it's an <a href="<entry-edit-url>/preview...">. We match on that exact
  // href shape so we don't accidentally tag the section TITLE ("Previzualizare"
  // / "Preview" — just a span, not clickable) or the "Set up preview" docs
  // link, which were both catching previously and made the SaveBar's Preview
  // button navigate to random places.
  // Strict regex: the entry edit preview link is always shaped like
  //   /content-manager/{collection-types|single-types}/<uid>/<documentId>/preview[?...]
  // — match exactly that structure so we never tag a sibling link that
  // happens to contain "/preview" elsewhere in its path.
  const STRICT_PREVIEW_RE =
    /\/content-manager\/(collection-types|single-types)\/[^/]+\/[^/]+\/preview(?:\?|$)/;

  const previewAnchors = document.querySelectorAll<HTMLAnchorElement>('a[href]');
  previewAnchors.forEach((el) => {
    if (el.hasAttribute(DEFAULT_PREVIEW_ATTR)) return;
    if (isInsideSaveBar(el)) return;
    if (isInsidePopover(el)) return;
    const href = el.getAttribute('href') ?? '';
    if (!STRICT_PREVIEW_RE.test(href)) return;
    el.setAttribute(DEFAULT_PREVIEW_ATTR, 'true');
    const card = findActionCard(el, PREVIEW_LABELS);
    if (card && !card.hasAttribute(DEFAULT_PREVIEW_CARD_ATTR)) {
      card.setAttribute(DEFAULT_PREVIEW_CARD_ATTR, 'true');
    }
  });
}

function setupAdminShell() {
  injectGlobalStyles();
  injectMobileStyles();
  mountMobileNav();
  mountSaveBar();
  mountBlocksToolbarExtra();
  tagAdminShellReliably();
  // Also tag Save/Preview now and on every nav-affecting mutation. The same
  // MutationObserver wired by tagAdminShellReliably observes the whole body
  // and runs its scheduled batch each frame; we attach our own observer here
  // for `button` and `a` mutations specifically.
  const runTaggers = () => {
    tagDefaultSaveAndPreview();
    tagRightRail();
  };
  runTaggers();
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      runTaggers();
    });
  };
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      for (const n of Array.from(r.addedNodes).concat(Array.from(r.removedNodes))) {
        if (n.nodeType !== Node.ELEMENT_NODE) continue;
        const el = n as Element;
        if (
          el.tagName === 'BUTTON' ||
          el.tagName === 'A' ||
          el.tagName === 'ASIDE' ||
          el.querySelector?.('button, a, aside')
        ) {
          schedule();
          return;
        }
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

export default {
  // Strapi's admin config. `locales` controls the language picker in user
  // profiles. `translations` provides our project-local Romanian strings —
  // Strapi 5.23 doesn't ship a `ro` translation file, so this is what
  // makes Romanian text actually render. Missing keys fall back to English
  // via react-intl's defaultMessage on each <FormattedMessage>.
  config: {
    locales: ['ro'],
    translations: {
      ro: roTranslations as Record<string, string>,
    },
  },
  register(app: StrapiApp) {
    componentPreview.register(app);
  },
  bootstrap() {
    // bootstrap can fire before document.body is ready in some edge cases; wait if so.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupAdminShell, { once: true });
    } else {
      setupAdminShell();
    }
  },
};
