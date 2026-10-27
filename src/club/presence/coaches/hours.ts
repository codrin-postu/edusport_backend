import type { LessonRow, SessionRow } from '../types';
import type { CoachRow } from '../attendance/api-types';

/** Hours to one decimal with a comma: 21,5 (4.3). */
export const hoursText = (minutes: number): string => (Math.round(minutes / 6) / 10).toFixed(1).replace('.', ',');

type CoachInput = {
  sessions: Pick<SessionRow, 'id' | 'coachIds' | 'durationMin'>[];
  presentBySession: Map<string, number>;
  lessons: Pick<LessonRow, 'coachIds' | 'durationMin' | 'present'>[];
  names: Record<string, string>;
};
type Tally = { sessions: number; lessons: number; minutes: number };

/** A session counts for each of its coaches with its full duration when someone was present (p5 Q25); a lesson counts when present (C18). */
export function coachRows(i: CoachInput): CoachRow[] {
  const tally = new Map<string, Tally>();
  const add = (coachId: string, sessions: number, lessons: number, minutes: number): void => {
    const t = tally.get(coachId) ?? { sessions: 0, lessons: 0, minutes: 0 };
    tally.set(coachId, { sessions: t.sessions + sessions, lessons: t.lessons + lessons, minutes: t.minutes + minutes });
  };
  for (const s of i.sessions) {
    if ((i.presentBySession.get(s.id) ?? 0) > 0) for (const c of s.coachIds) add(c, 1, 0, s.durationMin);
  }
  for (const l of i.lessons) {
    if (l.present === true) for (const c of l.coachIds) add(c, 0, 1, l.durationMin);
  }
  return [...tally]
    .map(([coachId, t]): CoachRow => ({ coachId, name: i.names[coachId] ?? '', sessions: t.sessions, lessons: t.lessons, minutes: t.minutes, hours: hoursText(t.minutes) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
}
