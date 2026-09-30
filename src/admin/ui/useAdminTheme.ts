import * as React from 'react';
import { THEMES, THEME_ATTR, type ThemeName } from './tokens';

/**
 * The one place that works out which theme the Strapi admin is showing.
 *
 * Strapi keeps the choice in localStorage under STRAPI_THEME as 'light',
 * 'dark' or 'system' (sometimes JSON-quoted); 'system' or nothing means
 * follow prefers-color-scheme. Strapi changes the value in the same tab when
 * the user switches theme in their profile, which fires no `storage` event,
 * so a slow poll backs up the storage and media-query listeners.
 *
 * Two entry points:
 *   - useAdminTheme(): React hook, for code inside or outside Strapi's
 *     providers;
 *   - getAdminTheme() + subscribeAdminTheme(): plain functions for code that
 *     mounts outside React providers (SaveBar, MobileNav, BlocksToolbarExtra,
 *     EdusportShell).
 *
 * While at least one subscriber is listening (startAdminThemeSync() is one),
 * the resolved name is mirrored on <html data-theme="...">, which is what
 * switches the --theme-* token blocks from ./tokens.ts.
 */

const STRAPI_THEME_KEY = 'STRAPI_THEME';
const POLL_MS = 1500;

function isThemeName(v: string): v is ThemeName {
  return Object.prototype.hasOwnProperty.call(THEMES, v);
}

function prefersDark(): boolean {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
  } catch {
    return false;
  }
}

/** The theme Strapi is showing right now. Safe to call anywhere, any time. */
export function getAdminTheme(): ThemeName {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = window.localStorage.getItem(STRAPI_THEME_KEY);
    if (raw) {
      const cleaned = raw.replace(/^"|"$/g, '').trim().toLowerCase();
      if (isThemeName(cleaned)) return cleaned;
    }
  } catch {
    /* localStorage unavailable: fall through to the system preference */
  }
  return prefersDark() ? 'dark' : 'light';
}

type Listener = (theme: ThemeName) => void;

const listeners = new Set<Listener>();
let current: ThemeName | null = null;
let teardown: (() => void) | null = null;

function applyAttr(theme: ThemeName) {
  try {
    const el = document.documentElement;
    if (el.getAttribute(THEME_ATTR) !== theme) el.setAttribute(THEME_ATTR, theme);
  } catch {
    /* no DOM */
  }
}

function check() {
  const next = getAdminTheme();
  if (next === current) return;
  current = next;
  applyAttr(next);
  listeners.forEach((fn) => fn(next));
}

function start() {
  current = getAdminTheme();
  applyAttr(current);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STRAPI_THEME_KEY) check();
  };
  window.addEventListener('storage', onStorage);
  let mq: MediaQueryList | null = null;
  try {
    mq = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
    mq?.addEventListener?.('change', check);
  } catch {
    mq = null;
  }
  const poll = window.setInterval(check, POLL_MS);
  teardown = () => {
    window.removeEventListener('storage', onStorage);
    mq?.removeEventListener?.('change', check);
    window.clearInterval(poll);
  };
}

/**
 * Call `fn` whenever the admin theme changes. Returns an unsubscribe function.
 * One shared set of listeners and one poll serve every subscriber.
 */
export function subscribeAdminTheme(fn: Listener): () => void {
  if (typeof window === 'undefined') return () => {};
  listeners.add(fn);
  if (!teardown) start();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && teardown) {
      teardown();
      teardown = null;
    }
  };
}

/**
 * Keep <html data-theme> in sync for the lifetime of the admin. Called once
 * from the admin bootstrap; idempotent.
 */
let permanent: (() => void) | null = null;
export function startAdminThemeSync(): void {
  if (permanent) return;
  permanent = subscribeAdminTheme(() => {});
}

const subscribeStore = (onChange: () => void) => subscribeAdminTheme(() => onChange());
const getSnapshot = (): ThemeName => current ?? getAdminTheme();
const getServerSnapshot = (): ThemeName => 'light';

/** React hook: the current admin theme name, re-rendering when it changes. */
export function useAdminTheme(): ThemeName {
  return React.useSyncExternalStore(subscribeStore, getSnapshot, getServerSnapshot);
}

export default useAdminTheme;
