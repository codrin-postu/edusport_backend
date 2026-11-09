import * as React from 'react';
import { Spinner } from '../../admin/ui/Spinner';
import type { Deps } from '../deps';
import { PATH } from '../flow';
import { finishGoogle } from '../handoff';
import { Shell } from '../Shell';
import { SECURITY_COPY } from '../../club/security/copy';

/**
 * `/login/done?remember=0|1`: the Google handoff page. The server left the access token in a readable `jwtToken` cookie (60 s); this takes
 * it, deletes the cookie at once as Strapi's SSO page does, moves it to `localStorage` when "Ține-mă minte" was ticked, and opens the admin.
 */
export function Done({ go, search }: Deps) {
  React.useEffect(() => {
    const q = new URLSearchParams(search);
    if (!finishGoogle(q.get('remember') === '1', window, q.get('to'))) go(PATH.login);
  }, [search, go]);
  return (
    <Shell title={SECURITY_COPY.login.title}>
      <Spinner size={24} label={SECURITY_COPY.login.title} />
    </Shell>
  );
}
