import type { AthleteRow, MembershipRow } from '../../athletes/store';
import { currentRows } from '../membership-plan';
import { groupSeries, runningOn, seasonBounds, type SeriesView } from '../series';
import type { EventRecord, GroupRecord, SeasonRecord, SectionRecord } from '../types';

/** Everything the new-season planners read (spec 10). `memberships` holds every row of both seasons. */
export type StartFacts = {
  current: SeasonRecord; target: SeasonRecord; groups: GroupRecord[]; sections: SectionRecord[]; athletes: AthleteRow[];
  memberships: MembershipRow[]; events: EventRecord[]; today: string;
};

/** Only Nou and Activ athletes are copied (10.3); Inactiv and anonymized never. */
export const copyable = (a: AthleteRow | undefined): a is AthleteRow => !!a && (a.status === 'nou' || a.status === 'activ');
export const seasonEndOf = (s: SeasonRecord): string => seasonBounds(s).end;

export const currentMembersOf = (f: StartFacts, groupId: string): MembershipRow[] =>
  f.memberships.filter((m) => m.groupId === groupId && m.seasonId === f.current.id && !m.to);

export const targetRowsOf = (f: StartFacts, athleteId: string): MembershipRow[] => currentRows(f.memberships, athleteId, f.target.id);

/** Series still running on the current season's last day: "Program obișnuit" at the season end (10.3, W27). */
export const runningAtEnd = (f: StartFacts, groupId: string): SeriesView[] =>
  groupSeries(f.events, groupId, f.current).filter((s) => runningOn(s, seasonEndOf(f.current)));

export const targetSeriesOf = (f: StartFacts, groupId: string): SeriesView[] => groupSeries(f.events, groupId, f.target);

/** New series and memberships start on the later of the new season's start and today (10.3, W27). */
export function seriesStart(f: StartFacts): string {
  const start = seasonBounds(f.target).start;
  return f.today > start ? f.today : start;
}
