import { PATH } from './flow';

export type Screen = 'login' | 'secondStep' | 'invite' | 'reset' | 'done' | 'offer';

/** The screen of a `/login` path. Unknown paths show the password form. */
export function screenOf(pathname: string): Screen {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (path === PATH.secondStep) return 'secondStep';
  if (path === PATH.invite) return 'invite';
  if (path === PATH.reset) return 'reset';
  if (path === PATH.done) return 'done';
  if (path === PATH.offer) return 'offer';
  return 'login';
}
