import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Tabs } from '../ui';
import { SPORTIVI_PATH, recordIdFromSplat } from '../../club/sportivi/routes';
import { TABLES_COPY } from '../../club/tables/copy';
import { readTablesQuery } from '../../club/tables/routes';
import { AthleteRecordPage } from './sportivi/AthleteRecordPage';
import { SportiviList } from './sportivi/SportiviList';
import { TabelePage } from './sportivi/tabele/TabelePage';

/** "Listă" | "Tabele" (the only tabs of phase 11): on the list, not on the record. `?vedere=tabele` picks the second one. */
function ListWithTabs() {
  const navigate = useNavigate();
  const { tab } = readTablesQuery(useLocation().search);
  const tabs = (
    <Tabs
      label={TABLES_COPY.tabs.lista} value={tab}
      items={[{ id: 'lista', label: TABLES_COPY.tabs.lista }, { id: 'tabele', label: TABLES_COPY.tabs.tabele }]}
      onChange={(next) => navigate(next === 'tabele' ? `${SPORTIVI_PATH}?vedere=tabele` : SPORTIVI_PATH)}
    />
  );
  return tab === 'tabele' ? <TabelePage tabs={tabs} /> : <SportiviList tabs={tabs} />;
}

/**
 * "Sportivi" (spec 5) and, under /plugins/edusport-sportivi/<documentId>, the athlete record
 * (spec 6). Strapi routes the menu link as `${to}/*`, so the splat holds the record id.
 */
export default function SportiviPage() {
  const id = recordIdFromSplat(useParams()['*']);
  return id ? <AthleteRecordPage key={id} documentId={id} /> : <ListWithTabs />;
}
