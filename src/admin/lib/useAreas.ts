import * as React from 'react';
import { getFetchClient } from '@strapi/admin/strapi-admin';
import type { AdminArea } from '../../club/admin-area';
import { areasOfMe } from '../../club/roles/map';

let pending: Promise<Set<AdminArea>> | null = null;

/** One GET /admin/users/me per page load, shared by every caller; a failed read is dropped so the next caller tries again. */
function loadAreas(): Promise<Set<AdminArea>> {
  if (!pending) {
    const read = getFetchClient().get('/admin/users/me').then((r) => areasOfMe(r.data));
    read.catch(() => {
      if (pending === read) pending = null;
    });
    pending = read;
  }
  return pending;
}

export type Areas = { ready: boolean; has: (area: AdminArea) => boolean };

/** The areas of the signed-in admin. `has` is false until the read answers, and stays false (not ready) when it fails. */
export function useAreas(): Areas {
  const [areas, setAreas] = React.useState<Set<AdminArea> | null>(null);
  React.useEffect(() => {
    let off = false;
    loadAreas().then((a) => {
      if (!off) setAreas(a);
    }, () => undefined);
    return () => {
      off = true;
    };
  }, []);
  const has = React.useCallback((area: AdminArea) => areas?.has(area) ?? false, [areas]);
  return React.useMemo(() => ({ ready: areas !== null, has }), [areas, has]);
}
