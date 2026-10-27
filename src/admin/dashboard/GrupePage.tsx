import * as React from 'react';
import { useParams } from 'react-router-dom';
import { groupIdFromSplat } from '../../club/grupe/routes';
import { GroupPage } from './grupe/GroupPage';
import { GrupeList } from './grupe/GrupeList';

/** "Grupe" (spec 5) and, under /plugins/edusport-grupe/<documentId>, the group page (spec 6). */
export default function GrupePage() {
  const id = groupIdFromSplat(useParams()['*']);
  return id ? <GroupPage key={id} documentId={id} /> : <GrupeList />;
}
