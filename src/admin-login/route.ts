import { PATH } from './flow';

export type Screen = 'login' | 'secondStep' | 'invite' | 'reset' | 'done';

/** The screen of a `/intrare` path. Unknown paths (and `/intrare/cheie` until the passkey offer exists) show the password form. */
export function screenOf(pathname: string): Screen {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (path === PATH.secondStep) return 'secondStep';
  if (path === PATH.invite) return 'invite';
  if (path === PATH.reset) return 'reset';
  if (path === PATH.done) return 'done';
  return 'login';
}
