import { forbiddenPathsIn } from '../forbidden-keys';
import type { NamedRow } from '../../groups/types';
import type { AthleteStatus } from '../../athlete-data';
import type { MemberRow } from '../../groups/api-types';
import type { LessonPanel, SessionPanel } from '../../presence/attendance/api-types';
import type { SeasonRecord } from '../../groups/types';
import type { LessonSeriesRow } from '../../presence/types';
import type { CoachLesson, CoachMember, LessonSeriesView, CoachPresenceRow, CoachSession, SectionKind } from './api-types';
import type { Right } from './rules';

/** Keys no coach answer may carry (spec 14.3), the coach's own `email` in `CoachMe` excepted through `allow`. */
export const FORBIDDEN_KEYS = [
  'price', 'amount', 'charges', 'birthDate', 'notes', 'address', 'audience', 'itemName', 'priceListId', 'history', 'email', 'registrations', 'documents', 'payments',
] as const;

/** Every forbidden key found anywhere in `value`, once each; `allow` names keys that may appear anywhere. */
export function forbiddenKeysIn(value: unknown, allow: string[] = []): string[] {
  const keyOf = (path: string): string => path.slice(path.lastIndexOf('.') + 1);
  return [...new Set(forbiddenPathsIn(value, FORBIDDEN_KEYS).map(keyOf).filter((k) => !allow.includes(k)))];
}

/** Club has no subscription text; a Școala child shows used/total or "Fără abonament". */
export function coachAbonamentText(kind: SectionKind, slots: { used: number; total: number } | null): string | null {
  if (kind === 'club') return null;
  return slots ? `${slots.used}/${slots.total}` : 'Fără abonament';
}

type SessionExtras = {
  ages: Map<string, number | null>; slots: Map<string, { used: number; total: number } | null>; team: NamedRow[]; right: Right; standIn: boolean;
};

const options = (team: NamedRow[]): { id: string; name: string }[] => team.map((t) => ({ id: t.id, name: t.name }));

export function toCoachSession(panel: SessionPanel, x: SessionExtras): CoachSession {
  const rows: CoachPresenceRow[] = panel.rows.map((r) => ({
    athleteId: r.athleteId, name: r.name, age: x.ages.get(r.athleteId) ?? null, inactive: r.inactive, visitor: r.visitor, grup: r.grup, uscat: r.uscat,
    abonament: r.visitor ? null : coachAbonamentText(panel.kind, x.slots.get(r.athleteId) ?? null),
  }));
  return {
    sessionId: panel.sessionId, occurrenceKey: panel.occurrenceKey,
    added: panel.added ? { groupId: panel.added.groupId, date: panel.added.date, startTime: panel.added.startTime, durationMin: panel.added.durationMin } : null,
    groupId: panel.groupId, groupName: panel.groupName, kind: panel.kind, date: panel.date, startTime: panel.startTime, durationMin: panel.durationMin,
    outsideSchedule: panel.outsideSchedule, coachIds: [...panel.coachIds], coachOptions: options(x.team), rows, savedLine: panel.savedLine,
    editable: x.right.write, archived: x.right.archived, standIn: x.standIn,
  };
}

/** The rule of a lesson series; `untilSeasonEnd` when `to` is the last day of the season that holds `from`. */
export function toLessonSeriesView(s: LessonSeriesRow, seasons: SeasonRecord[]): LessonSeriesView {
  const season = seasons.find((x) => x.startMonth.slice(0, 10) <= s.from && s.from <= x.endMonth.slice(0, 10));
  return {
    seriesId: s.id, freq: s.freq, days: [...s.days], weekOfMonth: s.weekOfMonth, startTime: s.startTime, durationMin: s.durationMin, from: s.from, to: s.to,
    untilSeasonEnd: !!season && season.endMonth.slice(0, 10) === s.to,
  };
}

export function toCoachLesson(panel: LessonPanel, x: { team: NamedRow[]; right: Right & { delete: boolean }; paid: boolean; series: LessonSeriesView | null; planEditable: boolean }): CoachLesson {
  return {
    lessonId: panel.lessonId, athleteId: panel.athleteId, athleteName: panel.athleteName, date: panel.date, startTime: panel.startTime, durationMin: panel.durationMin,
    coachIds: [...panel.coachIds], coachOptions: options(x.team), state: panel.state, present: panel.present, savedLine: panel.savedLine,
    editable: x.right.write, archived: x.right.archived, deletable: x.right.delete && !x.paid, series: x.series, planEditable: x.planEditable,
  };
}

export function toCoachMember(m: MemberRow, status: AthleteStatus, leavesOn: string | null = null): CoachMember {
  return { athleteId: m.athleteId, name: m.name, age: m.age, isNew: status === 'nou', alsoIn: m.others.map((o) => o.name), leavesOn };
}
