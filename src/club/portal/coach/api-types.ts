import type { Occurrence } from '../../../api/calendar-event/services/expand';
import type { GroupProgram } from '../../groups/program-read';
import type { AddedSession, SectionKind } from '../../presence/attendance/api-types';
import type { LessonState } from '../../presence/types';

export type { SectionKind };

/** JSON shapes of the coach routes (spec 8, 9). Only what the coach screens show: no price, amount, birth date, note, address or registration. */
export type CoachMe = { name: string; firstName: string; initials: string; email: string; phone: string | null; hasPassword: boolean; google: boolean };
export type CoachDevice = { id: string; label: string; lastSeenAt: string; current: boolean };
export type CoachClassRow = {
  sessionId: string | null; occurrenceKey: string | null; groupId: string; groupName: string; date: string; startTime: string; children: number; done: boolean; standIn: boolean;
};
export type CoachLessonRow = { lessonId: string; athleteName: string; date: string; startTime: string; durationMin: number; done: boolean };
export type CoachToday = { date: string; today: string; groups: CoachClassRow[]; lessons: CoachLessonRow[]; todo: CoachClassRow[] };
export type CoachGroupRow = { groupId: string; name: string; kind: SectionKind; program: string[]; children: number };
export type OtherGroupRow = { groupId: string; name: string; coaches: string[] };
export type CoachGroups = { mine: CoachGroupRow[]; others: OtherGroupRow[] };
export type CoachMember = { athleteId: string; name: string; age: number | null; isNew: boolean; alsoIn: string[] };
export type StandInSlot = { occurrenceKey: string; date: string; startTime: string };
export type CoachGroupPage = {
  groupId: string; name: string; kind: SectionKind; own: boolean; coaches: string[]; program: string[];
  /** null for another coach's group. */
  members: CoachMember[] | null;
  /** Other group only: scheduled classes from today - 7 to today, newest first. */
  standIn: StandInSlot[];
  /** Occurrence key of today's class (own or other), drives "Fă prezența" / "Înlocuiesc azi". */
  todayKey: string | null;
  /** Own Club group only. */
  programPublic: boolean | null;
};
export type CoachPresenceRow = {
  athleteId: string; name: string; age: number | null; inactive: boolean; visitor: boolean; grup: boolean; uscat: boolean; abonament: string | null;
};
export type CoachSession = {
  sessionId: string | null; occurrenceKey: string | null; added: AddedSession | null; groupId: string; groupName: string; kind: SectionKind;
  date: string; startTime: string; durationMin: number; outsideSchedule: boolean; coachIds: string[]; coachOptions: { id: string; name: string }[];
  rows: CoachPresenceRow[]; savedLine: string | null; editable: boolean; archived: boolean; standIn: boolean;
};
export type CoachLesson = {
  lessonId: string; athleteId: string; athleteName: string; date: string; startTime: string; durationMin: number; coachIds: string[];
  coachOptions: { id: string; name: string }[]; state: LessonState; present: boolean | null; savedLine: string | null; editable: boolean; archived: boolean; deletable: boolean;
};
export type CoachSearchRow = { athleteId: string; name: string; age: number | null };
export type CoachNewAthleteBody = { groupId: string; name: string; birthDate?: string | null; contactName?: string | null; phone?: string | null; email?: string | null };
export type CoachAthleteCard = {
  athleteId: string; name: string; age: number | null; groups: string[]; school: string | null; contact: { name: string | null; phone: string | null } | null;
};
export type CoachHistoryRow = {
  kind: 'grup' | 'inlocuitor' | 'individuala'; date: string; name: string; present: number | null; durationMin: number | null; sessionId: string | null; lessonId: string | null;
};
export type CoachHistory = { month: string; sessions: number; lessons: number; hours: string; rows: CoachHistoryRow[] };
export type CoachProgram = { kind: SectionKind; editable: boolean; programPublic: boolean | null; program: GroupProgram; occurrences: Occurrence[] };
