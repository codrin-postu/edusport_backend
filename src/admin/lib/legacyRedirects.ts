import { CUSTOM_PAGES, type CustomPageRoute } from '../pages/routes';

/**
 * Old content-manager URLs of the types that now have a custom page land on
 * that page (bookmarks, links in older pages, Strapi's own menu in default mode):
 *
 *   /admin/content-manager/single-types/<uid>[/...]              -> the page
 *   /admin/content-manager/collection-types/<uid>                -> the list page
 *   /admin/content-manager/collection-types/<uid>/create         -> edit page, new
 *                                                                   (list page for modal-edited types)
 *   /admin/content-manager/collection-types/<uid>/<documentId>   -> edit page ?id=<documentId>
 *                                                                   (list page ?id= for modal-edited types)
 *
 * Mechanism: a location listener started once from the app.tsx bootstrap. It
 * wraps history.pushState / replaceState (React Router navigates through them
 * and emits no event) and listens to popstate; on a match it replaces the
 * entry and fires popstate, which Strapi's data router follows (the same way
 * EdusportShell's spaNavigate works). The check is deferred one task after a
 * push, so it never runs inside the router's own navigation. On a direct load
 * the check runs before the router reads the URL.
 *
 * Escape hatch: `?strapi=1` on the old URL skips the redirect, so Strapi's
 * editor stays reachable for debugging. It holds while you stay on that type's
 * content-manager URLs (Strapi rewrites the query on its own), and ends as
 * soon as you leave them.
 *
 * Only CUSTOM_PAGES entries with `redirect: true` take part (Articole does not yet).
 */

const SINGLE_RE = /^\/admin\/content-manager\/single-types\/([^/?#]+)(?:\/.*)?$/;
const COLLECTION_RE = /^\/admin\/content-manager\/collection-types\/([^/?#]+)(?:\/([^/?#]+))?(?:\/.*)?$/;

let started = false;
let bypassUid: string | null = null;
/** The replaceState in place before ours, so our own replace does not re-enter the check. */
let originalReplace: History['replaceState'] | null = null;

function pageFor(uid: string, role: CustomPageRoute['role']): CustomPageRoute | undefined {
  return CUSTOM_PAGES.find((p) => p.redirect && p.uid === uid && p.role === role);
}

/** Where an old URL should go, or null. Exported for tests / other callers. */
export function legacyTarget(pathname: string): { uid: string; to: string } | null {
  const single = SINGLE_RE.exec(pathname);
  if (single) {
    const uid = decodeURIComponent(single[1]);
    const page = pageFor(uid, 'main');
    return page && page.kind === 'single' ? { uid, to: page.to } : null;
  }
  const coll = COLLECTION_RE.exec(pathname);
  if (coll) {
    const uid = decodeURIComponent(coll[1]);
    const main = pageFor(uid, 'main');
    if (!main || main.kind !== 'collection') return null;
    const docId = coll[2] ? decodeURIComponent(coll[2]) : null;
    if (!docId) return { uid, to: main.to };
    const edit = pageFor(uid, 'edit') ?? main;
    if (docId === 'create') return { uid, to: edit.to };
    return { uid, to: `${edit.to}?id=${encodeURIComponent(docId)}` };
  }
  return null;
}

function check(): void {
  const { pathname, search } = window.location;
  const hit = legacyTarget(pathname);
  if (!hit) {
    bypassUid = null;
    return;
  }
  if (new URLSearchParams(search).get('strapi') === '1' || bypassUid === hit.uid) {
    bypassUid = hit.uid;
    return;
  }
  bypassUid = null;
  // Keep React Router's history state (its idx / key), only the URL changes.
  (originalReplace ?? window.history.replaceState).call(window.history, window.history.state, '', `/admin${hit.to}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}

/** Start once (app.tsx bootstrap). Idempotent. */
export function startLegacyRedirects(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  originalReplace = window.history.replaceState;

  const wrap = (key: 'pushState' | 'replaceState') => {
    const original = window.history[key];
    window.history[key] = function (this: History, ...args: Parameters<History['pushState']>) {
      const out = original.apply(this, args);
      window.setTimeout(check, 0);
      return out;
    } as History[typeof key];
  };
  wrap('pushState');
  wrap('replaceState');
  window.addEventListener('popstate', () => window.setTimeout(check, 0));

  check();
}
