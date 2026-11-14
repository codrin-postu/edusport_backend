import * as React from 'react';
import { Checkbox } from '../ui';
import { groupLine } from '../../club/calendar/break-impact-copy';
import { sectionState, tickedSessions, toggleGroup, toggleSection, type TickTree } from '../../club/calendar/group-ticks';
import { countWords } from '../../club/ro-count';

type Props = { tree: TickTree; except: string[]; onChange: (except: string[]) => void; counts: boolean };

/** Sections with a tick box over their groups (dash when partly ticked); `counts` adds the session numbers. */
export function GroupTickTree({ tree, except, onChange, counts }: Props) {
  return (
    <div className="gtt">
      {tree.sections.map((s) => {
        const state = sectionState(s, except);
        const sum = counts ? countWords(tickedSessions(s, except), 'ședință', 'ședințe') : null;
        return (
          <div key={s.id} className="gtt-section">
            <div className="gtt-row gtt-head">
              <Checkbox checked={state === 'all'} indeterminate={state === 'some'} onChange={() => onChange(toggleSection(s, except))} label={s.name} />
              {sum && <span className="gtt-count">{sum}</span>}
            </div>
            {s.groups.map((g) => {
              const ticked = !except.includes(g.id);
              return (
                <div key={g.id} className="gtt-row gtt-group">
                  <Checkbox checked={ticked} onChange={() => onChange(toggleGroup(g.id, except))} label={g.name} />
                  {counts && <span className="gtt-count">{groupLine({ id: g.id, name: g.name, sessions: g.sessions ?? 0 }, ticked)}</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
