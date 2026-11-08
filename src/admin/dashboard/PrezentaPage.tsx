import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { todayIso } from '../../club/groups/http';
import { coachIdFromSplat, prezentaTo, readPrezentaQuery, type PrezentaQuery } from '../../club/prezenta/routes';
import { CoachPage } from './prezenta/CoachPage';
import { PrezentaScreen } from './prezenta/PrezentaScreen';

/**
 * "Prezență": the query in the address carries the tab, the day and the month (decided 2). Under
 * /plugins/edusport-prezenta/antrenor/<id> it is the coach page (Strapi routes the menu link as `${to}/*`).
 */
export default function PrezentaPage() {
  const coachId = coachIdFromSplat(useParams()['*']);
  return coachId ? <CoachPage key={coachId} coachId={coachId} /> : <PrezentaList />;
}

function PrezentaList() {
  const navigate = useNavigate();
  const query = readPrezentaQuery(useLocation().search, todayIso());
  const onQuery = (next: Partial<PrezentaQuery>) => navigate(prezentaTo({ ...query, ...next }), { replace: true });
  return <PrezentaScreen query={query} onQuery={onQuery} />;
}
