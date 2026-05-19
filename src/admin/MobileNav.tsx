import * as React from 'react';
import { createPortal } from 'react-dom';

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
const STRAPI_THEME_KEY = 'STRAPI_THEME';
const JWT_LOCALSTORAGE_KEY = 'jwtToken';
const JWT_COOKIE_NAME = 'jwtToken';

type ThemeName = 'light' | 'dark';

interface Palette {
  primary: string;
  surface: string;
  surfaceHover: string;
  border: string;
  text: string;
  textMuted: string;
  burgerBg: string;
  burgerFg: string;
  burgerBorder: string;
  backdrop: string;
  shadow: string;
}

const PALETTES: Record<ThemeName, Palette> = {
  light: {
    primary: '#4945ff',
    surface: '#ffffff',
    surfaceHover: '#f0f0ff',
    border: '#eaeaef',
    text: '#212134',
    textMuted: '#666687',
    burgerBg: '#ffffff',
    burgerFg: '#4945ff',
    burgerBorder: '#dcdce4',
    backdrop: 'rgba(33, 33, 52, 0.5)',
    shadow: '0 2px 8px rgba(33, 33, 52, 0.12)',
  },
  dark: {
    primary: '#7b79ff',
    surface: '#212134',
    surfaceHover: '#2c2c45',
    border: '#4a4a6a',
    text: '#f0f0ff',
    textMuted: '#a5a5ba',
    burgerBg: '#32324d',
    burgerFg: '#a5a5ba',
    burgerBorder: '#4a4a6a',
    backdrop: 'rgba(0, 0, 0, 0.6)',
    shadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
  },
};

function readStoredTheme(): ThemeName {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STRAPI_THEME_KEY);
  if (stored === 'dark') return 'dark';
  if (stored === 'light') return 'light';
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function useStrapiTheme(): ThemeName {
  const [theme, setTheme] = React.useState<ThemeName>(() => readStoredTheme());
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setTheme(readStoredTheme());
    window.addEventListener('storage', update);
    let mq: MediaQueryList | null = null;
    if (typeof window.matchMedia === 'function') {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', update);
      } else {
        mq.addListener(update);
      }
    }
    const poll = window.setInterval(update, 1500);
    return () => {
      window.removeEventListener('storage', update);
      window.clearInterval(poll);
      if (mq) {
        if (typeof mq.removeEventListener === 'function') {
          mq.removeEventListener('change', update);
        } else {
          mq.removeListener(update);
        }
      }
    };
  }, []);
  return theme;
}

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
  const theme = useStrapiTheme();
  const palette = PALETTES[theme];
  const [open, setOpen] = React.useState(false);
  const [groups, setGroups] = React.useState<NavGroup[]>([]);

  // Re-read every time the menu opens so the list reflects the current page
  // (the SubNav is only present when the user is inside Content Manager /
  // Settings, so its contents change as they navigate).
  React.useEffect(() => {
    if (!open) return;

    const sidebar = document.querySelector(SIDEBAR_SELECTOR);

    const sidebarLinks = readLinksFromContainer(sidebar);

    const next: NavGroup[] = [];
    if (sidebarLinks.length > 0) {
      next.push({ title: 'Navigare', items: sidebarLinks });
    }
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

  const burgerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    border: `1px solid ${palette.burgerBorder}`,
    borderRadius: 8,
    background: palette.burgerBg,
    color: palette.burgerFg,
    cursor: 'pointer',
    boxShadow: palette.shadow,
    zIndex: 99998,
  };

  const renderItem = (item: NavItem) => {
    const baseStyle: React.CSSProperties = {
      display: 'block',
      padding: '12px 16px',
      fontSize: 14,
      fontWeight: 500,
      color: palette.text,
      textDecoration: 'none',
      borderLeft: '3px solid transparent',
      background: 'transparent',
      width: '100%',
      textAlign: 'left',
      cursor: 'pointer',
      fontFamily: 'inherit',
    };
    const onMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = palette.surfaceHover;
      e.currentTarget.style.borderLeftColor = palette.primary;
    };
    const onMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.borderLeftColor = 'transparent';
    };

    if (item.href) {
      return (
        <a
          key={item.label + item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          style={baseStyle}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {item.label}
        </a>
      );
    }
    return (
      <button
        key={item.label}
        type="button"
        onClick={() => {
          setOpen(false);
          item.onClick?.();
        }}
        style={{ ...baseStyle, border: 'none' }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {item.label}
      </button>
    );
  };

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Deschide meniul"
        aria-expanded={open}
        style={burgerStyle}
      >
        <BurgerIcon />
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: palette.backdrop,
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <nav
            aria-label="Navigare mobilă"
            style={{
              width: '85%',
              maxWidth: 320,
              height: '100%',
              background: palette.surface,
              boxShadow:
                theme === 'dark'
                  ? '-2px 0 12px rgba(0,0,0,0.5)'
                  : '-2px 0 12px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 16px',
                borderBottom: `1px solid ${palette.border}`,
                position: 'sticky',
                top: 0,
                background: palette.surface,
                zIndex: 1,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: palette.textMuted,
                }}
              >
                Navigare
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Închide meniul"
                style={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: palette.text,
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <div style={{ padding: '8px 0', flex: 1 }}>
              {groups.length === 0 ? (
                <div style={{ padding: '16px', fontSize: 13, color: palette.textMuted }}>
                  Meniul Strapi nu este încă disponibil. Reîncarcă pagina dacă persistă.
                </div>
              ) : (
                groups.map((group, gi) => (
                  <div key={group.title + gi} style={{ padding: '8px 0' }}>
                    <div
                      style={{
                        padding: '8px 16px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: palette.textMuted,
                      }}
                    >
                      {group.title}
                    </div>
                    {group.items.map(renderItem)}
                  </div>
                ))
              )}
            </div>
          </nav>
        </div>
      )}
    </>,
    document.body,
  );
}
