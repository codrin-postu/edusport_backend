import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconChevronDown, IconChevronRight, IconChevronUp } from '../../ui/icons';
import type { RegistrationMatchView } from '../../../club/athletes/api-types';
import { MATCH_COPY } from '../../../club/inscrieri-copy';
import { athleteRecordPath, initials, lastGroupText } from '../../../club/inscrieri-panel';
import { CompareTable } from './CompareTable';

/**
 * "Sportiv existent" card above the tabs (spec 3.3), only while unconfirmed: no levels, no ticks, no count;
 * "Deschide fișa completă" opens the record in the same tab (gaps #33).
 */
export function MatchCard({ view }: { view: RegistrationMatchView }) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const card = view.existing;
  if (!card) return null;
  return (
    <div className="ins-mcard">
      <div className="ins-mcard-top">
        <span className="ins-av">{initials(card.name)}</span>
        <span className="ins-acard-t">
          <b>{MATCH_COPY.existing}</b>
          <span>{lastGroupText(card)}</span>
          {view.notAttendedLastSeason && <span>{MATCH_COPY.notAttended}</span>}
        </span>
        <button type="button" className="ins-link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? MATCH_COPY.hide : MATCH_COPY.compare}
          {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
        </button>
      </div>
      {open && (
        <div className="ins-mcard-body">
          <CompareTable rows={view.comparison} />
          <button type="button" className="ins-link ins-right" onClick={() => navigate(athleteRecordPath(card.documentId))}>
            {MATCH_COPY.openFull}
            <IconChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
