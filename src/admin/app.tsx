import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { StrapiApp } from '@strapi/strapi/admin';
import componentPreview from '../plugins/component-preview/admin/src';
import { MobileNav } from './MobileNav';

const SIDEBAR_DATA_ATTR = 'data-edusport-sidebar';
const SUBNAV_DATA_ATTR = 'data-edusport-subnav';
const SUBNAV_PARENT_DATA_ATTR = 'data-edusport-subnav-parent';

const GLOBAL_CSS = `
@media (min-width: 1280px) {
  main,
  [role="main"] {
    max-width: 1280px;
    margin-left: auto;
    margin-right: auto;
  }
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

function setupMobileShell() {
  injectGlobalStyles();
  injectMobileStyles();
  mountMobileNav();
  tagAdminShellReliably();
}

export default {
  register(app: StrapiApp) {
    componentPreview.register(app);
  },
  bootstrap() {
    // bootstrap can fire before document.body is ready in some edge cases; wait if so.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupMobileShell, { once: true });
    } else {
      setupMobileShell();
    }
  },
};
