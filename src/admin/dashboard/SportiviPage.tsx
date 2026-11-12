import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { recordIdFromSplat } from '../../club/sportivi/routes';
import { oldTablesRedirect } from '../../club/tables/routes';
import { AthleteRecordPage } from './sportivi/AthleteRecordPage';
import { SportiviList } from './sportivi/SportiviList';
import RedirectPage from './RedirectPage';

/** The list, or (an old `?vedere=tabele` address) a redirect to the Tabele page. */
function ListOrRedirect() {
  const { search } = useLocation();
  return oldTablesRedirect(search) ? <RedirectPage /> : <SportiviList />;
}

/**
 * "Sportivi" (spec 5) and, under /plugins/edusport-sportivi/<documentId>, the athlete record
 * (spec 6). Strapi routes the menu link as `${to}/*`, so the splat holds the record id.
 */
export default function SportiviPage() {
  const id = recordIdFromSplat(useParams()['*']);
  return id ? <AthleteRecordPage key={id} documentId={id} /> : <ListOrRedirect />;
}
