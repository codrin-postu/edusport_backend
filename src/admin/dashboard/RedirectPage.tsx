import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CONTABILITATE_PATH, oldMoneyRedirect } from '../../club/contabilitate/routes';
import { oldTablesRedirect } from '../../club/tables/routes';

/** The four old money pages (Abonamente, Plăți, De încasat, Bani): bookmarks and in-app links land on the matching Contabilitate tab (spec 2). */
export default function RedirectPage() {
  const { pathname, search } = useLocation();
  const to = oldMoneyRedirect(pathname, search) ?? oldTablesRedirect(search) ?? CONTABILITATE_PATH;
  return <Navigate to={to} replace />;
}
