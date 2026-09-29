import * as React from 'react';
import { useBlocker, useHref, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../ConfirmDialog';

/**
 * Leave guard for edit pages with unsaved changes.
 *
 * Three exits are covered while `dirty` is true:
 *   1. in-admin navigation through Strapi's router (links, back/forward,
 *      navigate()): react-router's useBlocker (Strapi 5 runs a data router);
 *   2. the EduSport sidebar and mobile nav, which render outside Strapi's
 *      router and navigate with pushState: their link clicks are intercepted
 *      in the capture phase before the shell handles them;
 *   3. reload, tab close, typing a URL: the browser's beforeunload prompt.
 * Leaving is confirmed through ConfirmDialog.
 *
 * Use the component (<UnsavedGuard when={dirty} />) or the hook, which
 * returns the dialog element the page must render.
 */

/** Roots rendered outside Strapi's router (see app.tsx / EdusportShell). */
const OUTSIDE_ROUTER_ROOTS = '#edusport-shell-root, #edusport-mobile-nav-root';

export interface UnsavedGuardOptions {
  title?: string;
  message?: string;
}

function stripBase(path: string, base: string): string {
  if (base && base !== '/' && path.startsWith(base)) return path.slice(base.length) || '/';
  return path;
}

export function useUnsavedGuard(dirty: boolean, opts: UnsavedGuardOptions = {}): React.ReactElement | null {
  const navigate = useNavigate();
  const base = useHref('/').replace(/\/$/, '');
  const allow = React.useRef(false);
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;
  const [pending, setPending] = React.useState<string | null>(null);

  const blocker = useBlocker(
    React.useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string; search: string }; nextLocation: { pathname: string; search: string } }) =>
        !allow.current &&
        dirtyRef.current &&
        (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
      [],
    ),
  );

  // Once the page is clean again, drop a block that is still pending.
  React.useEffect(() => {
    if (!dirty && blocker.state === 'blocked') blocker.reset();
  }, [dirty, blocker]);

  React.useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  React.useEffect(() => {
    if (!dirty) return undefined;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || !a.closest(OUTSIDE_ROUTER_ROOTS)) return;
      if (a.target && a.target !== '_self') return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty]);

  const open = blocker.state === 'blocked' || pending !== null;

  const stay = () => {
    if (blocker.state === 'blocked') blocker.reset();
    setPending(null);
  };

  const leave = () => {
    if (blocker.state === 'blocked') {
      blocker.proceed();
      return;
    }
    if (pending !== null) {
      const to = stripBase(pending, base);
      setPending(null);
      allow.current = true;
      navigate(to);
      window.setTimeout(() => {
        allow.current = false;
      }, 0);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      tone="danger"
      title={opts.title ?? 'Ai modificări nesalvate'}
      message={opts.message ?? 'Dacă pleci de pe pagină acum, modificările nesalvate se pierd.'}
      confirmLabel="Pleacă fără să salvezi"
      cancelLabel="Rămâi pe pagină"
      onConfirm={leave}
      onCancel={stay}
    />
  );
}

/** Component form of useUnsavedGuard. */
export function UnsavedGuard({ when, ...opts }: UnsavedGuardOptions & { when: boolean }) {
  return useUnsavedGuard(when, opts);
}

export default useUnsavedGuard;
