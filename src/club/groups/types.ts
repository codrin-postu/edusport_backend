import type { AthleteRow, MembershipRow, RegistrationRow, SectionRow } from '../athletes/store';
import type { AthleteStatus } from '../athlete-data';
import type { HistoryInput } from '../history';

/** Phase 4 rows as the group services see them. Ids are Strapi documentIds; dates 'YYYY-MM-DD'; times 'HH:mm'. */
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type Freq = 'none' | 'weekly' | 'biweekly' | 'monthly';
export type WeekOfMonth = 'first' | 'second' | 'third' | 'fourth' | 'last';
export type ExceptionKind = 'cancel' | 'override' | 'liber' | 'anulat' | 'sters';
export type ExceptionRow = {
  date: string; kind: ExceptionKind; newDate: string | null; newStartTime: string | null; newEndTime: string | null; newTitle: string | null; reason: string | null;
};
export type Recurrence = {
  freq: Freq; days: DayKey[]; weekOfMonth: WeekOfMonth | null; startTime: string | null; endTime: string | null;
  singleDate: string | null; seasonStart: string | null; seasonEnd: string | null;
};
export type EventRecord = { id: string; title: string; type: string; description: string | null; groupId: string | null; recurrence: Recurrence; exceptions: ExceptionRow[] };
export type EventWrite = Omit<EventRecord, 'id'>;
export type BreakRecord = { id: string; label: string; startDate: string; endDate: string };
export type GroupRecord = {
  id: string; name: string; sectionId: string | null; order: number | null; active: boolean; priceListId: string | null; coachIds: string[]; programPublic: boolean;
};
export type GroupWrite = { name: string; sectionId: string; priceListId: string | null; coachIds: string[]; programPublic: boolean };
/** `locationName`: the name of the section's location, null without one. */
export type SectionRecord = SectionRow & { slug: string; locationName?: string | null };
export type SeasonRecord = { id: string; label: string; startMonth: string; endMonth: string; isCurrent: boolean; membershipFee: number | null };
export type NamedRow = { id: string; name: string };
export type PriceListRow = { id: string; name: string; sectionId: string | null };
export type HistoryEntryRow = { id: string; seq: number; subjectType: string; subjectId: string; action: string; changes: Record<string, unknown>; actor: string; at: string };
export type ActionRef = { id: string; seq: number };
export type Subject = { type: string; id: string };
/** Stored on a `schedule-change` e-mail job (spec 3.6); `startTime` is the time of the changed date. */
export type ScheduleChangePayload = {
  groupName: string; date: string; startTime: string; mode: 'cancel' | 'move'; newDate: string | null; newStartTime: string | null;
  nextDate: string | null; nextStartTime: string | null; reason: string | null;
};
export type ScheduleEmailJob = { recipient: string; subject: string; groupId: string; changeKey: string; notBefore: string; payload: ScheduleChangePayload };
export type MembershipWhere = { seasonId?: string; groupId?: string; athleteId?: string };
export type NewMembership = { athleteId: string; groupId: string; seasonId: string; isMain: boolean; from: string | null };

export interface GroupStore {
  /** All writes inside `work` are saved together or not at all. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
  /** Inside a transaction: row locks held until it ends. Order: seasons, athletes, groups, events (each sorted by id). */
  lockSeason(id: string): Promise<void>;
  lockAthlete(id: string): Promise<void>;
  lockGroup(id: string): Promise<void>;
  lockEvent(id: string): Promise<void>;
  /** Taken last: serializes two undos of the same Istoric action even when its steps lock nothing. */
  lockHistoryEntry(id: string): Promise<void>;
  seasons(): Promise<SeasonRecord[]>;
  sections(): Promise<SectionRecord[]>;
  groups(): Promise<GroupRecord[]>;
  group(id: string): Promise<GroupRecord | null>;
  teamMembers(): Promise<NamedRow[]>;
  priceLists(): Promise<PriceListRow[]>;
  athletes(): Promise<AthleteRow[]>;
  athlete(id: string): Promise<AthleteRow | null>;
  /** Every row, ended ones included; filter with `isCurrentMembership`. */
  memberships(where?: MembershipWhere): Promise<MembershipRow[]>;
  /** Athletes with a live access whose account has the schedule mail switched off (portal notifySchedule false). */
  scheduleMutedAthletes(): Promise<string[]>;
  membership(id: string): Promise<MembershipRow | null>;
  registrations(): Promise<RegistrationRow[]>;
  /** Registrations filed under the season after `at` (new-season undo, W28). */
  registrationsFiledAfter(seasonId: string, at: string): Promise<number>;
  events(where?: { groupId?: string }): Promise<EventRecord[]>;
  event(id: string): Promise<EventRecord | null>;
  breaks(): Promise<BreakRecord[]>;
  history(subjectType: string, subjectId: string): Promise<HistoryEntryRow[]>;
  historyEntry(id: string): Promise<HistoryEntryRow | null>;
  /** Lines after `seq` on any of the subjects (null: on any subject at all), oldest first. */
  historyAfter(seq: number, subjects: Subject[] | null): Promise<HistoryEntryRow[]>;
  adminNames(emails: string[]): Promise<Record<string, string>>;
  createGroup(data: GroupWrite & { order: number }): Promise<string>;
  updateGroup(id: string, data: Partial<GroupWrite>): Promise<void>;
  deleteGroup(id: string): Promise<void>;
  createMembership(data: NewMembership & { to?: string | null }): Promise<string>;
  updateMembership(id: string, data: { isMain?: boolean; to?: string | null }): Promise<void>;
  deleteMembership(id: string): Promise<void>;
  setAthleteStatus(id: string, status: AthleteStatus): Promise<void>;
  createEvent(data: EventWrite): Promise<string>;
  updateEvent(id: string, data: Partial<Pick<EventRecord, 'recurrence' | 'exceptions' | 'title'>>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  createBreak(data: Omit<BreakRecord, 'id'>): Promise<string>;
  updateBreak(id: string, data: Omit<BreakRecord, 'id'>): Promise<void>;
  deleteBreak(id: string): Promise<void>;
  /** Queued `schedule-change` jobs; answers how many were written. */
  createEmailJobs(jobs: ScheduleEmailJob[]): Promise<number>;
  /** Every job of the change still queued becomes `cancelled`; answers how many. */
  cancelEmailJobs(changeKey: string): Promise<number>;
  /** How many jobs of the change were already sent (a sent e-mail cannot be taken back). */
  sentEmailJobs(changeKey: string): Promise<number>;
  setSeasonCurrent(id: string, isCurrent: boolean): Promise<void>;
  /** Writes one Istoric line and answers its documentId and order (the undo `actionId`). */
  recordAction(entry: HistoryInput): Promise<ActionRef>;
  record(entry: HistoryInput): Promise<void>;
  setHistoryChanges(id: string, changes: Record<string, unknown>): Promise<void>;
}
