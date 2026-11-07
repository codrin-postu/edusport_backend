import type { AdminState } from '../period';
import type { HeldOccurrence, LessonState, SessionState } from '../types';

export type SectionKind = 'school' | 'club';
export type DayRow = {
  sessionId: string | null; occurrenceKey: string | null; groupId: string; groupName: string; date: string; startTime: string;
  coachNames: string[]; present: number; listed: number; visitors: number; state: SessionState | null; outsideSchedule: boolean;
};
export type DayPage = { date: string; today: string; startDate: string | null; groupsWithoutList: number; undone: DayRow[]; day: DayRow[] };
export type PanelRow = {
  athleteId: string; name: string; visitor: boolean; inactive: boolean; mainGroup: string | null; abonament: string | null;
  grup: boolean; uscat: boolean; noSubscription: boolean;
};
export type AddedSession = { groupId: string; date: string; startTime: string; durationMin: number };
export type SessionPanel = {
  sessionId: string | null; occurrenceKey: string | null; added: AddedSession | null; groupId: string; groupName: string; kind: SectionKind;
  date: string; startTime: string; durationMin: number; outsideSchedule: boolean; coachIds: string[]; rows: PanelRow[]; savedLine: string | null; history: string[];
};
export type SavedOnDay = { sessionId: string; startTime: string; present: number; listed: number; savedBy: string };
export type SessionCheck =
  | { kind: 'existing'; sameTime: boolean; saved: SavedOnDay[] }
  | { kind: 'occurrence'; occurrenceKey: string }
  | { kind: 'free'; outsideSchedule: boolean };
export type SessionDefaults = { durationMin: number; coachIds: string[] };
export type Tick = { athleteId: string; grup: boolean; uscat: boolean };
export type SessionSaveBody = {
  id?: string; occurrence?: string; added?: AddedSession; coachIds: string[]; ticks: Tick[]; reactivate: string[]; keepInactive: string[];
};
export type InactiveAthlete = { id: string; name: string };
export type SessionSaved = { sessionId: string; toast: string };
export type PeriodRow = DayRow & { coachIds: string[]; adminState: AdminState };
export type PeriodPage = {
  from: string; to: string; today: string; startDate: string | null; groupsWithoutList: number;
  undone: PeriodRow[]; days: { date: string; rows: PeriodRow[] }[];
};
export type GridCell = { date: string; state: AdminState; present: number; listed: number; sessions: number };
export type GridPage = { from: string; to: string; dates: string[]; rows: { groupId: string; groupName: string; cells: GridCell[] }[] };
export type GroupMonth = { month: string; rows: PeriodRow[] };
export type LessonListRow = {
  lessonId: string; date: string; startTime: string; athleteId: string; athleteName: string; coachNames: string[]; durationMin: number;
  state: SessionState; present: boolean | null;
};
export type PeriodLessonRow = LessonListRow & { adminState: AdminState };
export type LessonPanel = {
  lessonId: string; athleteId: string; athleteName: string; date: string; startTime: string; durationMin: number; coachIds: string[];
  state: LessonState; present: boolean | null; savedLine: string | null; deletable: boolean;
};
export type LessonBody = { athleteId: string; date: string; startTime: string; durationMin: number; coachIds: string[] };
export type LessonPatch = { present: boolean; durationMin: number; coachIds: string[] };
export type LessonSaved = { lessonId: string; changed: boolean; toast: string };
export type CoachRow = { coachId: string; name: string; sessions: number; lessons: number; minutes: number; hours: string };
export type AthleteMonthRow = { sessionId: string; date: string; groupName: string; types: string; noSubscription: boolean };

/** Re-exported for panels that carry held occurrences. */
export type { HeldOccurrence };
