import { loginRedirect, isAdminAuthPath } from '../../club/admin-login/login-paths';

/**
 * Strapi's own sign-in pages are closed (6b-1 spec 4.1): the server redirects a hard load of `/admin/auth/*`, and this listener
 * catches what the SPA does on its own (its native logout, an expired session). The spike (T1) showed both are needed, and that a
 * `location.replace` to a path outside `/admin` is the way out, because a `replaceState` there does not leave the SPA router.
 */

/** Where an address leads when it is one of Strapi's auth pages, else null. `base` resolves a relative address. */
export function authRedirectTarget(url: string | URL | null | undefined, base: string): string | null {
  if (url === null || url === undefined) return null;
  let parsed: URL;
  try {
    parsed = new URL(String(url), base);
  } catch {
    return null;
  }
  const pathname = parsed.pathname.toLowerCase();
  return isAdminAuthPath(pathname) ? loginRedirect(pathname, parsed.search.replace(/^\?/, '')) : null;
}

let started = false;

/** Called once from the admin bootstrap: replaces the location when the SPA navigates to a Strapi auth page. */
export function startAuthRedirect(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const go = (url: string | URL | null | undefined): boolean => {
    const target = authRedirectTarget(url, window.location.href);
    if (!target) return false;
    window.location.replace(target);
    return true;
  };
  (['pushState', 'replaceState'] as const).forEach((name) => {
    const original = window.history[name].bind(window.history);
    window.history[name] = (state: unknown, title: string, url?: string | URL | null) => {
      if (!go(url)) original(state, title, url);
    };
  });
  window.addEventListener('popstate', () => void go(window.location.href));
  go(window.location.href);
}
