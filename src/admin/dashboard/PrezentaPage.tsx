import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { todayIso } from '../../club/groups/http';
import { prezentaTo, readPrezentaQuery, type PrezentaQuery } from '../../club/prezenta/routes';
import { PrezentaScreen } from './prezenta/PrezentaScreen';

/** "Prezență": the query in the address carries the tab, the day and the month (decided 2). */
export default function PrezentaPage() {
  const navigate = useNavigate();
  const query = readPrezentaQuery(useLocation().search, todayIso());
  const onQuery = (next: Partial<PrezentaQuery>) => navigate(prezentaTo({ ...query, ...next }), { replace: true });
  return <PrezentaScreen query={query} onQuery={onQuery} />;
}
