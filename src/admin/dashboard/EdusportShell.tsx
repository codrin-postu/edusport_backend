import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { EDUSPORT_LINKS, GROUP_LABEL, GROUP_ORDER, DASHBOARD_TO, UMAMI_URL } from './menu';
import type { Group } from './menu';

/**
 * EduSport custom admin shell: a navy, always-expanded, grouped sidebar plus a
 * light/default mode switch. Mounted on a body-level root (like MobileNav/SaveBar),
 * so it lives OUTSIDE Strapi's React providers.
 *
 * IMPORTANT: because it renders outside Strapi's ThemeProvider/Router, it must NOT
 * use any @strapi/design-system or @strapi/icons component (those call useTheme and
 * throw here) nor Strapi router hooks. It uses plain HTML, inline SVG, and the
 * History API instead.
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
type Mode = 'custom' | 'default';
const ROOT_ID = 'edusport-shell-root';
const SHELL_PARENT_ATTR = 'data-edusport-shell-parent';
const MODE_ATTR = 'data-esd-mode';

function getStoredMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'default' ? 'default' : 'custom';
  } catch {
    return 'custom';
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

/** Small inline marker, deliberately dependency-free (no @strapi/icons). */
function NavDot() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="10" height="10" rx="2.5" fill="currentColor" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={open ? 'esd-chev open' : 'esd-chev'} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const SHELL_CSS = `
/* --- mode-driven layout ------------------------------------------------ */
html[${MODE_ATTR}="custom"] nav[data-edusport-sidebar] { display: none !important; }
html[${MODE_ATTR}="custom"] [${SHELL_PARENT_ATTR}] { padding-left: 236px !important; }
@media (max-width: 640px) {
  html[${MODE_ATTR}="custom"] [${SHELL_PARENT_ATTR}] { padding-left: 0 !important; }
  .esd-side { display: none !important; }
}

/* --- navy sidebar ------------------------------------------------------ */
.esd-side {
  position: fixed; top: 0; left: 0; width: 236px; height: 100dvh;
  background: #0e1a3c; color: #c8cee0; z-index: 100;
  display: flex; flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
}
.esd-brand { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid rgba(255,255,255,.08); }
.esd-brand .mark { width: 32px; height: 32px; border-radius: 8px; background: #2138b8; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; font-size: 13px; flex-shrink: 0; }
.esd-brand b { color: #fff; font-size: 15px; letter-spacing: .02em; display: block; line-height: 1.15; }
.esd-brand small { color: #8b93ad; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.esd-nav { flex: 1; overflow-y: auto; padding: 8px 0 14px; }
.esd-grp { padding: 14px 18px 4px; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #727b97; font-weight: 700; }
.esd-grp-btn { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; background: none; border: none; cursor: pointer; padding: 15px 18px 6px; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #727b97; font-weight: 700; font-family: inherit; }
.esd-grp-btn:hover { color: #aab2c9; }
.esd-grp-btn .esd-chev { width: 11px; height: 11px; flex-shrink: 0; opacity: .7; transition: transform .15s ease; }
.esd-grp-btn .esd-chev.open { transform: rotate(90deg); }
.esd-nav a { display: flex; align-items: center; gap: 11px; padding: 9px 18px; font-size: 13.5px; color: #c8cee0; text-decoration: none; cursor: pointer; border-left: 3px solid transparent; }
.esd-nav a:hover { background: rgba(255,255,255,.05); color: #fff; }
.esd-nav a.on { background: rgba(33,56,184,.35); color: #fff; border-left-color: #4d68ff; }
.esd-nav a svg { width: 15px; height: 15px; flex-shrink: 0; opacity: .8; }
.esd-foot { padding: 12px 14px; border-top: 1px solid rgba(255,255,255,.08); }
.esd-switch { width: 100%; padding: 9px 12px; background: rgba(255,255,255,.06); color: #c8cee0; border: 1px solid rgba(255,255,255,.14); border-radius: 8px; font-size: 12.5px; cursor: pointer; font-family: inherit; }
.esd-switch:hover { background: rgba(255,255,255,.12); color: #fff; }

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

  const toggleGroup = (g: Group) => setOpenGroups((prev) => {
    const next = { ...prev, [g]: !prev[g] };
    try { localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  // Reflect the mode on <html> so SHELL_CSS can hide/show and pad the layout.
  // Done in an effect (after a successful render) so a render failure never
  // leaves the nav hidden with nothing to replace it.
  React.useEffect(() => {
    document.documentElement.setAttribute(MODE_ATTR, mode);
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  // Track SPA route changes (browser navigation and our own spaNavigate).
  React.useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // In custom mode the plain Strapi home is redirected to the custom dashboard.
  React.useEffect(() => {
    if (mode === 'custom' && isHome(path)) spaNavigate(DASHBOARD_TO);
  }, [mode, path]);

  const go = (to: string) => (e: React.MouseEvent) => { e.preventDefault(); spaNavigate(to); };
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

  return (
    <aside className="esd-side" aria-label="Navigare EduSport">
      <div className="esd-brand">
        <span className="mark">ES</span>
        <span><b>EduSport</b><small>Panou</small></span>
      </div>
      <nav className="esd-nav">
        <a href={`/admin${DASHBOARD_TO}`} className={isActive(DASHBOARD_TO) ? 'on' : ''} onClick={go(DASHBOARD_TO)}>
          <NavDot /> Acasă
        </a>
        {UMAMI_URL ? (
          <a href={UMAMI_URL} target="_blank" rel="noopener noreferrer">
            <NavDot /> Analiză trafic
          </a>
        ) : null}
        {EDUSPORT_LINKS.filter((l) => l.pinned).map((l) => (
          <a key={l.to} href={`/admin${l.to}`} className={isActive(l.to) ? 'on' : ''} onClick={go(l.to)}>
            <NavDot /> {l.label}
          </a>
        ))}
        {GROUP_ORDER.map((group) => {
          const links = EDUSPORT_LINKS.filter((l) => l.group === group && !l.pinned);
          if (links.length === 0) return null;
          const open = !!openGroups[group];
          return (
            <div key={group} className="esd-group">
              <button type="button" className="esd-grp-btn" onClick={() => toggleGroup(group)} aria-expanded={open}>
                <span>{GROUP_LABEL[group]}</span>
                <Chevron open={open} />
              </button>
              {open && links.map((l) => (
                <a key={l.to} href={`/admin${l.to}`} className={isActive(l.to) ? 'on' : ''} onClick={go(l.to)}>
                  <NavDot /> {l.label}
                </a>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="esd-foot">
        <button className="esd-switch" type="button" onClick={() => setMode('default')}>
          Comută la meniul Strapi
        </button>
      </div>
    </aside>
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
