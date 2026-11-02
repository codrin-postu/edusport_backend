import * as React from 'react';
import { createPortal } from 'react-dom';
import { ensureAdminUi } from './ui/styles';
import { EDUSPORT_LINKS, GROUP_LABEL, GROUP_ORDER } from './dashboard/menu';

interface NavItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const SIDEBAR_SELECTOR = 'nav[data-edusport-sidebar]';
const JWT_LOCALSTORAGE_KEY = 'jwtToken';
const JWT_COOKIE_NAME = 'jwtToken';

/*
 * Mounted from app.tsx outside every page, so the portal carries its own
 * `.ui-root`: the --theme-* tokens (light / dark, kept in step with Strapi's
 * theme by useAdminTheme through ensureAdminUi) style it, no private palette.
 * Kept free of backticks: one stray backtick takes the admin down.
 */
const NAV_CSS = `
.ui-root .edu-mnav-burger{position:fixed;top:12px;right:12px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;padding:0;border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);background:var(--theme-surface);color:var(--theme-primary);cursor:pointer;box-shadow:var(--theme-shadow-sm);z-index:99998}
.ui-root .edu-mnav-burger:focus-visible,.ui-root .edu-mnav-close:focus-visible,.ui-root .edu-mnav-item:focus-visible{outline:2px solid var(--theme-focus);outline-offset:-2px}
.ui-root .edu-mnav-backdrop{position:fixed;inset:0;background:var(--theme-overlay);z-index:99999;display:flex;justify-content:flex-end}
.ui-root .edu-mnav-panel{width:85%;max-width:320px;height:100%;background:var(--theme-surface);box-shadow:var(--theme-shadow-md);display:flex;flex-direction:column;overflow-y:auto;font-family:var(--ui-font)}
.ui-root .edu-mnav-head{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--theme-border);position:sticky;top:0;background:var(--theme-surface);z-index:1}
.ui-root .edu-mnav-title{font-size:14px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-muted)}
.ui-root .edu-mnav-close{width:36px;height:36px;display:flex;align-items:center;justify-content:center;padding:0;border:none;background:transparent;border-radius:var(--ui-radius-sm);cursor:pointer;color:var(--theme-text)}
.ui-root .edu-mnav-close:hover{background:var(--theme-surface-subtle)}
.ui-root .edu-mnav-body{padding:8px 0;flex:1}
.ui-root .edu-mnav-empty{padding:16px;font-size:13px;color:var(--theme-text-muted)}
.ui-root .edu-mnav-group{padding:8px 0}
.ui-root .edu-mnav-gtitle{padding:8px 16px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--theme-text-muted)}
.ui-root .edu-mnav-item{display:block;padding:12px 16px;font-size:14px;font-weight:500;color:var(--theme-text);text-decoration:none;border:none;border-left:3px solid transparent;background:transparent;width:100%;text-align:left;cursor:pointer;font-family:inherit}
.ui-root .edu-mnav-item:hover{background:var(--theme-primary-soft);border-left-color:var(--theme-primary)}
`;

function useIsMobile(query = '(max-width: 640px)'): boolean {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, [query]);
  return matches;
}

/*
 * Two sources. The EduSport links (EDUSPORT_LINKS, the desktop sidebar's list)
 * come first, by group, so Grupe, Sportivi, Prezență and the rest always show.
 * Reading them only from Strapi's nav failed on phones: that nav is found by
 * the sticky-and-tall tagging in app.tsx (display:none here, and only tagged
 * once laid out), so the lookup came back empty. Strapi's nav still adds what
 * the EduSport list lacks (Content Manager, Settings, other plugin links) when
 * it is tagged; entries already covered by an EduSport link are dropped.
 */
export function eduLinkHref(to: string): string {
  return '/admin' + to;
}

function readLinksFromContainer(container: Element | null): NavItem[] {
  if (!container) return [];
  const seen = new Set<string>();
  const out: NavItem[] = [];
  container.querySelectorAll('a[href]').forEach((a) => {
    const href = (a as HTMLAnchorElement).getAttribute('href') || '';
    if (!href || href === '#' || seen.has(href)) return;
    const ariaLabel = (a.getAttribute('aria-label') || '').trim();
    const text = (a.textContent || '').trim();
    const label = ariaLabel || text;
    if (!label) return;
    seen.add(href);
    out.push({ href, label });
  });
  return out;
}

/**
 * Strapi v5 stores the JWT in localStorage (key 'jwtToken') and a same-name
 * cookie. Logout clears both then sends the user to the login screen.
 */
function logout() {
  try {
    window.localStorage.removeItem(JWT_LOCALSTORAGE_KEY);
  } catch {
    /* localStorage not available - ignore */
  }
  // Clear the cookie by setting Max-Age=0 across plausible paths
  document.cookie = `${JWT_COOKIE_NAME}=; path=/; max-age=0`;
  document.cookie = `${JWT_COOKIE_NAME}=; path=/admin; max-age=0`;
  window.location.assign('/admin/auth/login');
}

function BurgerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function MobileNav() {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [groups, setGroups] = React.useState<NavGroup[]>([]);

  // Tokens + theme sync (idempotent; the bootstrap already ran it).
  React.useInsertionEffect(() => ensureAdminUi(), []);

  // Re-read every time the menu opens so the Strapi extras reflect the current page.
  React.useEffect(() => {
    if (!open) return;

    const next: NavGroup[] = [];
    const covered = new Set<string>();
    for (const group of GROUP_ORDER) {
      const items = EDUSPORT_LINKS.filter((l) => l.group === group).map((l) => {
        const href = eduLinkHref(l.to);
        covered.add(href);
        return { label: l.label, href };
      });
      if (items.length > 0) next.push({ title: GROUP_LABEL[group], items });
    }
    const extra = readLinksFromContainer(document.querySelector(SIDEBAR_SELECTOR)).filter((l) => !covered.has(l.href ?? ''));
    if (extra.length > 0) next.push({ title: 'Navigare', items: extra });
    next.push({
      title: 'Cont',
      items: [
        { label: 'Profilul meu', href: '/admin/me' },
        { label: 'Deconectare', onClick: logout },
      ],
    });

    setGroups(next);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!isMobile) return null;

  const renderItem = (item: NavItem) => {
    if (item.href) {
      return (
        <a key={item.label + item.href} href={item.href} className="edu-mnav-item" onClick={() => setOpen(false)}>
          {item.label}
        </a>
      );
    }
    return (
      <button
        key={item.label}
        type="button"
        className="edu-mnav-item"
        onClick={() => {
          setOpen(false);
          item.onClick?.();
        }}
      >
        {item.label}
      </button>
    );
  };

  return createPortal(
    <div className="ui-root">
      <style>{NAV_CSS}</style>
      <button
        type="button"
        className="edu-mnav-burger"
        onClick={() => setOpen(true)}
        aria-label="Deschide meniul"
        aria-expanded={open}
      >
        <BurgerIcon />
      </button>

      {open && (
        <div
          className="edu-mnav-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <nav aria-label="Navigare mobilă" className="edu-mnav-panel">
            <div className="edu-mnav-head">
              <span className="edu-mnav-title">Navigare</span>
              <button type="button" className="edu-mnav-close" onClick={() => setOpen(false)} aria-label="Închide meniul">
                <CloseIcon />
              </button>
            </div>

            <div className="edu-mnav-body">
              {groups.length === 0 ? (
                <div className="edu-mnav-empty">Meniul Strapi nu este încă disponibil. Reîncarcă pagina dacă persistă.</div>
              ) : (
                groups.map((group, gi) => (
                  <div key={group.title + gi} className="edu-mnav-group">
                    <div className="edu-mnav-gtitle">{group.title}</div>
                    {group.items.map(renderItem)}
                  </div>
                ))
              )}
            </div>
          </nav>
        </div>
      )}
    </div>,
    document.body,
  );
}
