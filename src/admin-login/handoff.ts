import type { AdminHandoff } from '../club/security/api-types';
import { PATH } from './flow';

/** Strapi's own storage names for the admin session (`@strapi/admin` reducer.mjs, utils/cookies.mjs). */
const TOKEN_KEY = 'jwtToken';
const STATUS_KEY = 'isLoggedIn';
/** `admin.auth.cookie.path` default: where the SPA reads a non-remembered token. */
const SPA_COOKIE_PATH = '/admin';
/** Where the server's Google handoff sets the readable `jwtToken` cookie (spec 4.6). */
const SERVER_COOKIE_PATH = '/';
const GONE = 'Expires=Thu, 01 Jan 1970 00:00:01 GMT';
export const ADMIN_HOME = '/admin';
/** Where `/login/done?to=` may lead: an allow-list of names, never an address from the query. */
export const DONE_TARGETS: Record<string, string> = { securitate: '/admin/plugins/edusport-securitate' };

/** The slice of `window` the handoff touches; a test passes a fake. */
export type HandoffWindow = {
  localStorage: Pick<Storage, 'setItem' | 'removeItem'>;
  document: { cookie: string };
  location: { protocol: string; assign: (url: string) => void };
};

const secureAttr = (w: HandoffWindow): string => (w.location.protocol === 'https:' ? '; Secure' : '');

const expire = (w: HandoffWindow, path: string): void => {
  w.document.cookie = `${TOKEN_KEY}=; Path=${path}; ${GONE}`;
};

/**
 * Hands the access token to Strapi's SPA exactly as its own login does: remembered in `localStorage`, otherwise in the `jwtToken` cookie
 * the SPA reads (`Path=/admin`, `Secure` over TLS); `isLoggedIn` in both cases. The copy in the other place is removed so none shadows the new token.
 */
export function storeToken(token: string, remember: boolean, w: HandoffWindow): void {
  expire(w, SERVER_COOKIE_PATH);
  if (remember) {
    expire(w, SPA_COOKIE_PATH);
    w.localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  } else {
    w.localStorage.removeItem(TOKEN_KEY);
    w.document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; Path=${SPA_COOKIE_PATH}${secureAttr(w)}`;
  }
  w.localStorage.setItem(STATUS_KEY, 'true');
}

/** Stores the session of a login answer and opens the admin. */
export function storeHandoff(h: AdminHandoff, w: HandoffWindow): void {
  storeToken(h.accessToken, h.remember, w);
  w.location.assign(ADMIN_HOME);
}

/** The token of the server's `jwtToken` cookie (Google login), deleted at once as Strapi's SSO page does; null when there is none. */
export function takeGateToken(w: HandoffWindow): string | null {
  const pair = w.document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${TOKEN_KEY}=`));
  expire(w, SERVER_COOKIE_PATH);
  if (!pair) return null;
  const raw = pair.slice(TOKEN_KEY.length + 1);
  try {
    return decodeURIComponent(raw) || null;
  } catch {
    return null;
  }
}

/** `/login/done`: moves the Google token into the SPA's storage (`remember` as the first step asked) and opens the admin; false when no token came. */
export function finishGoogle(remember: boolean, w: HandoffWindow, to: string | null = null): boolean {
  const token = takeGateToken(w);
  if (!token) return false;
  storeToken(token, remember, w);
  w.location.assign(to !== null && Object.prototype.hasOwnProperty.call(DONE_TARGETS, to) ? DONE_TARGETS[to] : ADMIN_HOME);
  return true;
}

/**
 * What a login that ended in a session leads to. Without `offerPasskey` the admin opens at once. With it, and only on a device that has a
 * built-in key, the token is stored first (the offer's calls are signed in) and the page moves to the offer; on any other device the admin opens.
 */
export async function openAfterLogin(
  h: AdminHandoff,
  platformKey: () => Promise<boolean>,
  w: HandoffWindow,
  go: (url: string, carry: { token: string }) => void,
): Promise<void> {
  if (!h.offerPasskey || !(await platformKey().catch(() => false))) return storeHandoff(h, w);
  storeToken(h.accessToken, h.remember, w);
  go(PATH.offer, { token: h.accessToken });
}
