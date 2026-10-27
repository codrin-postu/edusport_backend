import * as React from 'react';
import { superAdminFromMe } from '../../../club/personal-data/roles';
import { useStableClient } from '../inscrieri/useClient';

/** Hides Super Admin actions (3C spec 6); the server policy is the authority. False until /admin/users/me answers. */
export function useIsSuperAdmin(): boolean {
  const client = useStableClient();
  const [superAdmin, setSuperAdmin] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    client.get('/admin/users/me').then((r) => {
      if (!off) setSuperAdmin(superAdminFromMe(r.data));
    }).catch(() => undefined);
    return () => {
      off = true;
    };
  }, [client]);
  return superAdmin;
}
