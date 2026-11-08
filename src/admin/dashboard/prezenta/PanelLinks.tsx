import * as React from 'react';
import { Link } from 'react-router-dom';
import { PANEL_LINKS } from '../../../club/presence/copy/prezenta-ui';
import { coachPageTo } from '../../../club/prezenta/routes';
import { athleteRecordTo } from '../../../club/sportivi/routes';

type CoachLinksProps = { coaches: { id: string; name: string }[]; date: string; from: string };

/** "Antrenori: Ana, Dan": each name opens the coach page on the month of the date, in the same tab; Înapoi returns to `from`. */
export function CoachLinks({ coaches, date, from }: CoachLinksProps) {
  if (coaches.length === 0) return null;
  return (
    <p className="pz-sheet-sub">
      {PANEL_LINKS.coaches}
      {coaches.map((c, i) => (
        <React.Fragment key={c.id}>
          {i > 0 && ', '}
          <Link className="pz-name-link" to={coachPageTo(c.id, 'luna', date)} state={{ from }}>{c.name}</Link>
        </React.Fragment>
      ))}
    </p>
  );
}

/** An athlete's name: opens the record in a new tab, so the open panel is not lost. */
export function AthleteLink({ id, name }: { id: string; name: string }) {
  return <Link className="pz-name-link" to={athleteRecordTo(id)} target="_blank" rel="noopener">{name}</Link>;
}
