import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { EDUSPORT_LINKS, GROUP_LABEL, GROUP_ORDER, DASHBOARD_TO, UMAMI_URL, ANUNTURI_TO } from './menu';
import type { Group } from './menu';

/**
 * EduSport custom admin shell: a navy, grouped sidebar that collapses to a 58px
 * icon rail, plus a light/default mode switch. Mounted on a body-level root
 * (like MobileNav/SaveBar), so it lives OUTSIDE Strapi's React providers.
 *
 * IMPORTANT: because it renders outside Strapi's ThemeProvider/Router, it must NOT
 * use any @strapi/design-system or @strapi/icons component (those call useTheme and
 * throw here) nor Strapi router hooks. It uses plain HTML, inline SVG, and the
 * History API instead. That is why the category glyphs below are hand-rolled SVG
 * paths and not the icon components menu.tsx imports for the Strapi menu.
 *
 * Two looks, switchable, custom by default:
 *   - "custom":  Strapi's main nav is hidden, this navy sidebar replaces it, and
 *                the home route redirects to the custom dashboard page.
 *   - "default": untouched Strapi admin, with a small button to return to custom.
 * The choice is persisted in localStorage. If the shell ever fails to render, an
 * error boundary restores Strapi's own nav so the admin is never left blank.
 */

const MODE_KEY = 'edusport-admin-mode';
const NAV_OPEN_KEY = 'edusport-nav-open';
const NAV_RAIL_KEY = 'edusport-nav-rail';
type Mode = 'custom' | 'default';
const ROOT_ID = 'edusport-shell-root';
const SHELL_PARENT_ATTR = 'data-edusport-shell-parent';
const MODE_ATTR = 'data-esd-mode';
/** Mirrors the collapsed state on <html> so the content padding can follow the rail. */
const RAIL_ATTR = 'data-esd-rail';

function getStoredMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'default' ? 'default' : 'custom';
  } catch {
    return 'custom';
  }
}

function getStoredRail(): boolean {
  try {
    return localStorage.getItem(NAV_RAIL_KEY) === '1';
  } catch {
    return false;
  }
}

type OpenState = Partial<Record<Group, boolean>>;

/** Which link groups start expanded: the user's saved choice, or (first run) the
 *  group holding the current route so it is not hidden. */
function getInitialOpen(pathname: string): OpenState {
  try {
    const raw = localStorage.getItem(NAV_OPEN_KEY);
    if (raw) return JSON.parse(raw) as OpenState;
  } catch { /* ignore */ }
  const active = EDUSPORT_LINKS.find((l) => pathname.startsWith(`/admin${l.to}`));
  return active ? { [active.group]: true } : {};
}


/* --- account ---------------------------------------------------------------
 * The shell hides Strapi's own nav, and that nav is where the profile and the
 * logout live, so this panel had no way out of the session at all.
 *
 * Done by hand rather than with Strapi's `useAuth`: this tree mounts on a body
 * level root, outside Strapi's providers, so its hooks are unavailable here
 * (same reason the file avoids @strapi/design-system).
 *
 * Keys and endpoint read from the admin build: reducer.js stores the token as
 * `jwtToken` and the flag as `isLoggedIn`, and services/auth.js posts to
 * /admin/logout.
 */
const TOKEN_KEY = 'jwtToken';
const STATUS_KEY = 'isLoggedIn';

function readToken(): string | null {
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    // Stored JSON-encoded; older sessions may hold a bare string.
    try { return JSON.parse(raw); } catch { return raw; }
  } catch {
    return null;
  }
}

async function logOut(): Promise<void> {
  const token = readToken();
  try {
    // Tell the server first, while the token is still valid, so the session is
    // invalidated there and not merely forgotten here.
    await fetch('/admin/logout', {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    // Offline or server down: still clear locally, below.
  }
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(STATUS_KEY);
  } catch {
    /* private mode */
  }
  window.location.href = '/admin/auth/login';
}

/** Initials for the avatar, from a name if we have one, else the address. */
function initialsOf(user: { firstname?: string; lastname?: string; email?: string }): string {
  const first = (user.firstname || '').trim();
  const last = (user.lastname || '').trim();
  if (first || last) return ((first[0] || '') + (last[0] || '')).toUpperCase() || '?';
  return (user.email || '?').slice(0, 2).toUpperCase();
}

/** Emitted by our history patch so the shell sees pushState navigations. */
const ROUTE_EVENT = 'edusport:routechange';

/** Navigate within Strapi's SPA from outside its Router (pushState + popstate). */
function spaNavigate(to: string): void {
  const full = to.startsWith('/admin') ? to : `/admin${to}`;
  if (window.location.pathname + window.location.search === full) return;
  window.history.pushState({}, '', full);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function isHome(pathname: string): boolean {
  return pathname === '/admin' || pathname === '/admin/';
}

/* --- icons -------------------------------------------------------------- */
/**
 * Hand-rolled glyphs. They live here rather than in menu.tsx because this file
 * renders outside Strapi's providers and must not touch @strapi/icons.
 */
type IconKey = 'house' | 'chart' | 'bell' | 'gear' | 'feather' | 'calendar' | 'user' | 'grid' | 'book' | 'exit';

const ICON_PATHS: Record<IconKey, React.ReactNode> = {
  house: <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  chart: <><path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-3" /></>,
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.35.41.64.76.83H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  feather: <><path d="M20 12a8 8 0 0 0-8-8 8 8 0 0 0-8 8v8h8a8 8 0 0 0 8-8z" /><path d="M8 20l8-8" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  user: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  exit: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
};

function Icon({ name, className }: { name: IconKey; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/** One glyph per category. Kept here (not in menu.tsx) for the provider reason above. */
const GROUP_ICON: Record<Group, IconKey> = {
  forms: 'feather',
  program: 'calendar',
  team: 'user',
  pages: 'grid',
  content: 'book',
  system: 'gear',
};

/** Glyphs for the pinned top-level rows, which sit outside any category. */
const PINNED_ICON: Record<string, IconKey> = { [ANUNTURI_TO]: 'bell' };

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={open ? 'esd-chev open' : 'esd-chev'} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Caret used by the collapse / expand controls (points left when expanded). */
function Caret({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}

export const SHELL_CSS = `
/* --- mode-driven layout ------------------------------------------------ */
html[${MODE_ATTR}="custom"] nav[data-edusport-sidebar] { display: none !important; }
html[${MODE_ATTR}="custom"] [${SHELL_PARENT_ATTR}] {
  padding-left: 236px !important;
  transition: padding-left .26s cubic-bezier(.4,0,.2,1);
}
html[${MODE_ATTR}="custom"][${RAIL_ATTR}="1"] [${SHELL_PARENT_ATTR}] { padding-left: 58px !important; }
@media (max-width: 640px) {
  html[${MODE_ATTR}="custom"] [${SHELL_PARENT_ATTR}],
  html[${MODE_ATTR}="custom"][${RAIL_ATTR}="1"] [${SHELL_PARENT_ATTR}] { padding-left: 0 !important; }
  .esd-side { display: none !important; }
  .esd-fly { display: none !important; }
}

/* --- navy sidebar ------------------------------------------------------ */
.esd-side {
  position: fixed; top: 0; left: 0; width: 236px; height: 100dvh;
  background: #0e1a3c; color: #c8cee0; z-index: 100;
  display: flex; flex-direction: column; overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
  transition: width .26s cubic-bezier(.4,0,.2,1);
}
.esd-side.rail { width: 58px; }
.esd-side .esd-brand { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid rgba(255,255,255,.08); white-space: nowrap; flex-shrink: 0; }
.esd-side .esd-brand .mark { width: 32px; height: 32px; border-radius: 8px; background: #2138b8; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; font-size: 13px; flex-shrink: 0; }
.esd-side .esd-brand b { color: #fff; font-size: 15px; letter-spacing: .02em; display: block; line-height: 1.15; }
.esd-side .esd-brand small { color: #8b93ad; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.esd-brand-text { transition: opacity .16s ease; }
.esd-collapse { margin-left: auto; background: none; border: none; color: #8b93ad; cursor: pointer; padding: 5px; border-radius: 6px; display: flex; flex-shrink: 0; }
.esd-collapse:hover { background: rgba(255,255,255,.08); color: #fff; }
.esd-collapse svg { width: 15px; height: 15px; }
.esd-nav { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px 0 14px; }
.esd-grp-btn { display: flex; align-items: center; gap: 9px; width: 100%; background: none; border: none; border-left: 3px solid transparent; cursor: pointer; padding: 15px 18px 6px; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #727b97; font-weight: 700; font-family: inherit; text-align: left; white-space: nowrap; }
.esd-grp-btn:hover { color: #aab2c9; }
.esd-grp-btn .esd-gicon { width: 15px; height: 15px; flex-shrink: 0; color: #c8cee0; opacity: .8; }
.esd-grp-btn .esd-glabel { flex: 1; min-width: 0; transition: opacity .16s ease; }
.esd-grp-btn .esd-chev { width: 11px; height: 11px; flex-shrink: 0; opacity: .7; transition: transform .15s ease; }
.esd-grp-btn .esd-chev.open { transform: rotate(90deg); }
.esd-nav a { display: flex; align-items: center; gap: 11px; padding: 9px 18px; font-size: 13.5px; color: #c8cee0; text-decoration: none; cursor: pointer; border-left: 3px solid transparent; white-space: nowrap; }
.esd-nav a:hover { background: rgba(255,255,255,.05); color: #fff; }
.esd-nav a.on { background: rgba(33,56,184,.35); color: #fff; border-left-color: #4d68ff; }
.esd-nav a svg { width: 15px; height: 15px; flex-shrink: 0; opacity: .8; }
/* page links inside a category: plain indented text, no glyph */
.esd-nav a.esd-sub { padding-left: 32px; font-size: 13px; color: #aeb6cd; }
.esd-nav a.esd-sub:hover, .esd-nav a.esd-sub.on { color: #fff; }
.esd-lbl { transition: opacity .16s ease; }
.esd-foot { padding: 12px 14px; border-top: 1px solid rgba(255,255,255,.08); flex-shrink: 0; }
.esd-switch { width: 100%; padding: 9px 12px; background: rgba(255,255,255,.06); color: #c8cee0; border: 1px solid rgba(255,255,255,.14); border-radius: 8px; font-size: 12.5px; cursor: pointer; font-family: inherit; white-space: nowrap; }
.esd-switch:hover { background: rgba(255,255,255,.12); color: #fff; }
.esd-who { display: flex; align-items: center; gap: 9px; margin-bottom: 9px; min-width: 0; }
.esd-av { width: 26px; height: 26px; border-radius: 50%; background: #2138b8; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.esd-mail { font-size: 11px; color: #c8cee0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.esd-acts { display: flex; flex-direction: column; gap: 2px; margin-bottom: 9px; }
.esd-act { text-align: left; background: none; border: none; padding: 5px 0; font-size: 12px; color: #c8cee0; cursor: pointer; font-family: inherit; text-decoration: none; }
.esd-act:hover { color: #fff; }
.esd-act.out { color: #ff9c8a; }
.esd-act.out:hover { color: #ffb9ac; }
/* In the rail the footer is hidden, so the way out must not go with it. */
.esd-railacct { display: none; }
.esd-side.rail .esd-railacct { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 0; border-top: 1px solid rgba(255,255,255,.08); flex-shrink: 0; }
.esd-railacct a, .esd-railacct button { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; color: #c8cee0; font-size: 10px; font-weight: 700; padding: 0; font-family: inherit; text-decoration: none; }
.esd-railacct .esd-av { width: 26px; height: 26px; }
.esd-railacct button:hover { color: #fff; }
.esd-railacct button.out { color: #ff9c8a; }
.esd-railbtn { display: none; }

/* --- collapsed rail ---------------------------------------------------- */
/* Left padding stays 18px so glyphs never slide sideways while the width animates. */
.esd-side.rail .esd-lbl,
.esd-side.rail .esd-brand-text { opacity: 0; width: 0; overflow: hidden; }
.esd-side.rail .esd-nav a { gap: 0; }
.esd-side.rail .esd-nav a.esd-sub { display: none; }
.esd-side.rail .esd-grp-btn { padding: 9px 18px 3px; gap: 0; margin-top: 6px; color: #9aa3bd; }
.esd-side.rail .esd-grp-btn:hover { color: #fff; }
.esd-side.rail .esd-grp-btn .esd-glabel,
.esd-side.rail .esd-grp-btn .esd-chev { display: none; }
.esd-side.rail .esd-collapse { display: none; }
.esd-side.rail .esd-foot { display: none; }
.esd-side.rail .esd-railbtn { display: flex; align-items: center; justify-content: center; padding: 10px 0; background: none; border: none; color: #8b93ad; cursor: pointer; flex-shrink: 0; }
.esd-side.rail .esd-railbtn:hover { color: #fff; }
.esd-side.rail .esd-railbtn svg { width: 15px; height: 15px; }

/* --- category flyout (rail only) --------------------------------------- */
.esd-fly {
  position: fixed; left: 58px; top: 0; bottom: 0; width: 206px; z-index: 99;
  background: #16234d; border-left: 1px solid rgba(255,255,255,.08);
  padding: 10px 0; overflow-y: auto;
  font-family: system-ui, -apple-system, sans-serif;
  animation: esd-fly-in .18s ease both;
}
@keyframes esd-fly-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
.esd-fly .esd-fly-title { padding: 8px 16px 6px; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #8b93ad; font-weight: 700; }
.esd-fly a { display: block; padding: 7px 16px; font-size: 13px; color: #c8cee0; text-decoration: none; white-space: nowrap; cursor: pointer; }
.esd-fly a:hover { background: rgba(255,255,255,.06); color: #fff; }
.esd-fly a.on { background: rgba(33,56,184,.35); color: #fff; }

@media (prefers-reduced-motion: reduce) {
  .esd-side,
  .esd-lbl,
  .esd-brand-text,
  .esd-grp-btn .esd-glabel,
  html[${MODE_ATTR}="custom"] [${SHELL_PARENT_ATTR}] { transition: none !important; }
  .esd-fly { animation: none !important; }
}

/* --- floating switch shown in default mode ----------------------------- */
.esd-fab { position: fixed; left: 16px; bottom: 16px; z-index: 100; display: flex; align-items: center; gap: 8px; padding: 9px 14px; background: #0e1a3c; color: #fff; border: none; border-radius: 22px; font-size: 12.5px; font-family: system-ui, -apple-system, sans-serif; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.25); }
.esd-fab:hover { background: #16234d; }
.esd-fab .mark { width: 20px; height: 20px; border-radius: 6px; background: #2138b8; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 10px; }
@media (max-width: 640px) { .esd-fab { display: none; } }
`;

/**
 * Tag the layout element holding Strapi's main nav so CSS can reserve space for
 * the custom sidebar. Idempotent; no-op until Strapi's nav is tagged.
 */
export function tagShellParent(): void {
  const nav = document.querySelector<HTMLElement>('nav[data-edusport-sidebar]');
  const parent = nav?.parentElement;
  if (parent && !parent.hasAttribute(SHELL_PARENT_ATTR)) {
    parent.setAttribute(SHELL_PARENT_ATTR, 'true');
  }
}

function EdusportShell() {
  const [mode, setMode] = React.useState<Mode>(getStoredMode);
  const [path, setPath] = React.useState<string>(() => window.location.pathname);
  const [openGroups, setOpenGroups] = React.useState<OpenState>(() => getInitialOpen(window.location.pathname));
  const [railed, setRailed] = React.useState<boolean>(getStoredRail);
  const [flyGroup, setFlyGroup] = React.useState<Group | null>(null);
  const [me, setMe] = React.useState<{ email: string; initials: string } | null>(null);

  React.useEffect(() => {
    const token = readToken();
    if (!token) return;
    let off = false;
    fetch('/admin/users/me', {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const u = j?.data;
        if (off || !u?.email) return;
        setMe({ email: u.email, initials: initialsOf(u) });
      })
      .catch(() => {
        // The footer falls back to the actions alone; losing the address
        // must not cost the way out of the session.
      });
    return () => {
      off = true;
    };
  }, []);

  const toggleGroup = (g: Group) => setOpenGroups((prev) => {
    const next = { ...prev, [g]: !prev[g] };
    try { localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  const toggleRail = () => {
    setFlyGroup(null);
    setRailed((prev) => {
      const next = !prev;
      try { localStorage.setItem(NAV_RAIL_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  // Reflect the mode on <html> so SHELL_CSS can hide/show and pad the layout.
  // Done in an effect (after a successful render) so a render failure never
  // leaves the nav hidden with nothing to replace it.
  React.useEffect(() => {
    document.documentElement.setAttribute(MODE_ATTR, mode);
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  // Mirror the rail state on <html> so the content padding follows the sidebar.
  React.useEffect(() => {
    if (railed) document.documentElement.setAttribute(RAIL_ATTR, '1');
    else document.documentElement.removeAttribute(RAIL_ATTR);
  }, [railed]);

  // Escape closes the category flyout.
  React.useEffect(() => {
    if (!flyGroup) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFlyGroup(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flyGroup]);

  // Track SPA route changes.
  //
  // `popstate` alone is not enough: it fires for browser back/forward and for
  // our own spaNavigate, but React Router navigates with history.pushState and
  // emits nothing. Any move made by Strapi's own UI therefore left `path`
  // stale and the sidebar highlighting the previous page. Patch pushState and
  // replaceState to emit a private event, and listen for that too.
  React.useEffect(() => {
    const sync = () => setPath(window.location.pathname);

    const patch = (key: 'pushState' | 'replaceState') => {
      const original = window.history[key];
      const wrapped = function (this: History, ...args: Parameters<History['pushState']>) {
        const out = original.apply(this, args);
        window.dispatchEvent(new Event(ROUTE_EVENT));
        return out;
      };
      window.history[key] = wrapped as History[typeof key];
      return () => {
        window.history[key] = original;
      };
    };

    const restorePush = patch('pushState');
    const restoreReplace = patch('replaceState');
    window.addEventListener('popstate', sync);
    window.addEventListener(ROUTE_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(ROUTE_EVENT, sync);
      restorePush();
      restoreReplace();
    };
  }, []);

  // In custom mode the plain Strapi home is redirected to the custom dashboard.
  React.useEffect(() => {
    if (mode === 'custom' && isHome(path)) spaNavigate(DASHBOARD_TO);
  }, [mode, path]);

  const go = (to: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setFlyGroup(null);
    spaNavigate(to);
  };
  const isActive = (to: string) => {
    const full = to.startsWith('/admin') ? to : `/admin${to}`;
    return path.startsWith(full);
  };

  // Never cover the login / auth screens.
  if (path.startsWith('/admin/auth')) return null;

  if (mode === 'default') {
    return (
      <button className="esd-fab" type="button" onClick={() => setMode('custom')} aria-label="Comută la panoul EduSport">
        <span className="mark">ES</span> Panou EduSport
      </button>
    );
  }

  const groupLinks = (group: Group) => EDUSPORT_LINKS.filter((l) => l.group === group && !l.pinned);
  const flyLinks = flyGroup ? groupLinks(flyGroup) : [];

  return (
    <>
      <aside className={railed ? 'esd-side rail' : 'esd-side'} aria-label="Navigare EduSport">
        <div className="esd-brand">
          <span className="mark">ES</span>
          <span className="esd-brand-text"><b>EduSport</b><small>Panou</small></span>
          <button
            type="button"
            className="esd-collapse"
            onClick={toggleRail}
            aria-label="Pliază bara"
            aria-expanded={!railed}
          >
            <Caret dir="left" />
          </button>
        </div>
        <nav className="esd-nav">
          <a
            href={`/admin${DASHBOARD_TO}`}
            className={isActive(DASHBOARD_TO) ? 'on' : ''}
            onClick={go(DASHBOARD_TO)}
            title={railed ? 'Acasă' : undefined}
          >
            <Icon name="house" /><span className="esd-lbl">Acasă</span>
          </a>
          {UMAMI_URL ? (
            <a href={UMAMI_URL} target="_blank" rel="noopener noreferrer" title={railed ? 'Analiză trafic' : undefined}>
              <Icon name="chart" /><span className="esd-lbl">Analiză trafic</span>
            </a>
          ) : null}
          {EDUSPORT_LINKS.filter((l) => l.pinned).map((l) => (
            <a
              key={l.to}
              href={`/admin${l.to}`}
              className={isActive(l.to) ? 'on' : ''}
              onClick={go(l.to)}
              title={railed ? l.label : undefined}
            >
              <Icon name={PINNED_ICON[l.to] ?? 'gear'} /><span className="esd-lbl">{l.label}</span>
            </a>
          ))}
          {GROUP_ORDER.map((group) => {
            const links = groupLinks(group);
            if (links.length === 0) return null;
            const open = !!openGroups[group];
            return (
              <div key={group} className="esd-group">
                <button
                  type="button"
                  className="esd-grp-btn"
                  onClick={() => (railed ? setFlyGroup((prev) => (prev === group ? null : group)) : toggleGroup(group))}
                  aria-expanded={railed ? flyGroup === group : open}
                  aria-label={GROUP_LABEL[group]}
                  title={railed ? GROUP_LABEL[group] : undefined}
                >
                  <Icon name={GROUP_ICON[group]} className="esd-gicon" />
                  <span className="esd-glabel">{GROUP_LABEL[group]}</span>
                  <Chevron open={open} />
                </button>
                {!railed && open && links.map((l) => (
                  <a key={l.to} href={`/admin${l.to}`} className={isActive(l.to) ? 'esd-sub on' : 'esd-sub'} onClick={go(l.to)}>
                    {l.label}
                  </a>
                ))}
              </div>
            );
          })}
        </nav>
        <button type="button" className="esd-railbtn" onClick={toggleRail} aria-label="Desfă bara" aria-expanded={!railed}>
          <Caret dir="right" />
        </button>
        <div className="esd-railacct">
          {me ? <span className="esd-av" title={me.email}>{me.initials}</span> : null}
          <button type="button" className="out" onClick={logOut} title="Ieși din cont" aria-label="Ieși din cont">
            <Icon name="exit" />
          </button>
        </div>
        <div className="esd-foot">
          {me ? (
            <div className="esd-who">
              <span className="esd-av">{me.initials}</span>
              <span className="esd-mail" title={me.email}>{me.email}</span>
            </div>
          ) : null}
          <div className="esd-acts">
            <a className="esd-act" href="/admin/me" onClick={go('/me')}>
              Contul meu
            </a>
            <button className="esd-act out" type="button" onClick={logOut}>
              Ieși din cont
            </button>
          </div>
          <button className="esd-switch" type="button" onClick={() => setMode('default')}>
            Comută la meniul Strapi
          </button>
        </div>
      </aside>
      {railed && flyGroup ? (
        <nav className="esd-fly" aria-label={GROUP_LABEL[flyGroup]}>
          <div className="esd-fly-title">{GROUP_LABEL[flyGroup]}</div>
          {flyLinks.map((l) => (
            <a key={l.to} href={`/admin${l.to}`} className={isActive(l.to) ? 'on' : ''} onClick={go(l.to)}>
              {l.label}
            </a>
          ))}
        </nav>
      ) : null}
    </>
  );
}

/** Falls back to Strapi's own nav (clears the mode attribute) if the shell throws. */
class ShellErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    try { document.documentElement.removeAttribute(MODE_ATTR); } catch { /* ignore */ }
  }
  render() { return this.state.failed ? null : this.props.children; }
}

export function mountEdusportShell(): void {
  if (document.getElementById(ROOT_ID)) return;
  const root = document.createElement('div');
  root.id = ROOT_ID;
  document.body.appendChild(root);
  createRoot(root).render(
    <ShellErrorBoundary>
      <EdusportShell />
    </ShellErrorBoundary>,
  );
}
