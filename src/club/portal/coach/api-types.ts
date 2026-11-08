import type { Occurrence } from '../../../api/calendar-event/services/expand';
import type { GroupProgram } from '../../groups/program-read';
import type { AddedSession, SavedOnDay, SectionKind, SessionCheck } from '../../presence/attendance/api-types';
import type { LessonState } from '../../presence/types';

export type { SectionKind };

/** JSON shapes of the coach routes (spec 8, 9). Only what the coach screens show: no price, amount, birth date, note, address or registration. */
export type CoachMe = {
  name: string; firstName: string; initials: string; email: string; phone: string | null; hasPassword: boolean; google: boolean;
  /** The coach's own team member documentId (a lesson's `coachIds` must contain it). */
  coachId: string;
  /** Team members who coach any group: id and name only, for choosing a lesson's coaches. */
  coachOptions: { id: string; name: string }[];
};
/** Dates of one month (`YYYY-MM-DD`, ascending) that have a saved session the coach may read. */
export type CoachSavedDays = { month: string; dates: string[] };
export type CoachDevice = { id: string; label: string; lastSeenAt: string; current: boolean };
export type CoachClassRow = {
  sessionId: string | null; occurrenceKey: string | null; groupId: string; groupName: string; date: string; startTime: string; children: number; done: boolean; standIn: boolean;
  location: string | null;
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
/** A saved session of the day in the "+ Ședință nouă" answer. `listed` is true when the calling coach is in that session's coaches (replaces the phase 5 roster count, which no coach screen shows). */
export type CoachSavedOnDay = Omit<SavedOnDay, 'listed'> & { listed: boolean };
export type CoachSessionCheck = Exclude<SessionCheck, { kind: 'existing' }> | { kind: 'existing'; sameTime: boolean; saved: CoachSavedOnDay[] };
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
/** Competitions of one athlete; `{ available: false }` until a real source exists (plan Task 7 and 8). */
export type CoachAthleteCompetitions =
  | { available: false }
  | { available: true; category: string | null; season: string; count: number; podiums: number;
      recent: { eventName: string; date: string | null; location: string | null; placement: number | null; total: number | null }[] };
export type CoachAthleteCard = {
  athleteId: string; name: string; age: number | null; groups: string[]; school: string | null; contact: { name: string | null; phone: string | null } | null;
  /** Section of the main group today, e.g. "Școala de patinaj". */
  sectionName: string | null;
  /** Current groups, main first. */
  groupRows: { groupId: string; name: string; program: string[] }[];
  presence: { season: number; lessons: number; last: string | null; missedThisMonth: number };
  /** Own children only. */
  abonament: { code: string | null; next: number; slots: number; validUntil: string; location: string | null } | null;
  competitions: CoachAthleteCompetitions;
};
export type CoachCalendarItem = {
  kind: 'grup' | 'individual'; cancelled: boolean; date: string; startTime: string; durationMin: number | null; title: string;
  children: number | null; location: string | null; done: boolean; standIn: boolean;
  sessionId: string | null; occurrenceKey: string | null; lessonId: string | null;
};
export type CoachCalendar = { month: string; today: string; days: { date: string; items: CoachCalendarItem[] }[] };
export type CoachMemberChange = { athleteName: string; groupName: string; from: string; toast: string };
export type CoachHistoryRow = {
  kind: 'grup' | 'inlocuitor' | 'individuala'; date: string; name: string; present: number | null; durationMin: number | null; sessionId: string | null; lessonId: string | null;
};
export type CoachHistory = { month: string; sessions: number; lessons: number; hours: string; rows: CoachHistoryRow[] };
export type CoachProgram = { kind: SectionKind; editable: boolean; programPublic: boolean | null; program: GroupProgram; occurrences: Occurrence[] };
