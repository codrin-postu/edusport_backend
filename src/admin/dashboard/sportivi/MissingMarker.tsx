import * as React from 'react';
import { IconWarning } from '../../ui/icons';
import type { AthleteListRow } from '../../../club/athletes/api-types';
import { LIST_COPY, missingTip } from '../../../club/sportivi/list-view';

/** "date lipsă" under the name, the missing fields in its tooltip and for screen readers (table rows and phone cards). */
export function MissingMarker({ row }: { row: AthleteListRow }) {
  const tip = missingTip(row);
  return (
    <span className="spv-miss" title={tip ?? undefined}>
      <IconWarning size={12} />
      {LIST_COPY.incompleteMarker}
      {tip && <span className="ui-sr">{tip}</span>}
    </span>
  );
}
