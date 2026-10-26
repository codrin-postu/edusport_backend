import * as React from 'react';
import { useParams } from 'react-router-dom';
import { recordIdFromSplat } from '../../club/sportivi/routes';
import { AthleteRecordPage } from './sportivi/AthleteRecordPage';
import { SportiviList } from './sportivi/SportiviList';

/**
 * "Sportivi" (spec 5) and, under /plugins/edusport-sportivi/<documentId>, the athlete record
 * (spec 6). Strapi routes the menu link as `${to}/*`, so the splat holds the record id.
 */
export default function SportiviPage() {
  const id = recordIdFromSplat(useParams()['*']);
  return id ? <AthleteRecordPage key={id} documentId={id} /> : <SportiviList />;
}
