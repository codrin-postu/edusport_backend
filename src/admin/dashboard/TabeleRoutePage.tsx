import * as React from 'react';
import { tablesVisible } from '../../club/features/visible';
import { useFeatures } from '../lib/useFeatures';
import { NoAccess } from '../ui/NoAccess';
import { TabelePage } from './sportivi/tabele/TabelePage';

/** The Tabele page (spec 6): its own route, `/plugins/edusport-tabele`, no tabs. With no table subject left (attendance and subscriptions off) the address shows NoAccess. */
export default function TabeleRoutePage() {
  const { on } = useFeatures();
  if (!tablesVisible(on)) return <NoAccess />;
  return <TabelePage />;
}
