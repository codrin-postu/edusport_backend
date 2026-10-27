import * as React from 'react';
import { IconWarning } from '../../ui/icons';
import type { AthleteListRow } from '../../../club/athletes/api-types';
import { LIST_COPY, missingTip } from '../../../club/sportivi/list-view';

/** "date lipsă" under the name (rows; `card`: "Date incomplete"), the missing fields in its tooltip and for screen readers. */
export function MissingMarker({ row, card = false }: { row: AthleteListRow; card?: boolean }) {
  const tip = missingTip(row);
  return (
    <span className="spv-miss" title={tip ?? undefined}>
      <IconWarning size={12} />
      {card ? LIST_COPY.cardIncompleteMarker : LIST_COPY.incompleteMarker}
      {tip && <span className="ui-sr">{tip}</span>}
    </span>
  );
}
