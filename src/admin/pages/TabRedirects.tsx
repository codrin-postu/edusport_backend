import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { tabAddress, type TabId } from '../../club/tab-hosts';
import { ISTORIC_TO, PAGINA_PARTENERI_TO } from './routes';

function ListRedirect({ base, tab }: { base: string; tab: TabId }) {
  const { search } = useLocation();
  return <Navigate to={tabAddress(base, tab, search)} replace />;
}

/** The old list routes, now tabs: they replace themselves with the host page and the right tab. */
export const SponsoriRedirect: React.FC = () => <ListRedirect base={PAGINA_PARTENERI_TO} tab="sponsori" />;
export const EvenimenteRedirect: React.FC = () => <ListRedirect base={PAGINA_PARTENERI_TO} tab="evenimente" />;
export const MomenteRedirect: React.FC = () => <ListRedirect base={ISTORIC_TO} tab="momente" />;
