import type { AcsState } from '../acs';
import type { AthleteStatus, AthleteValues } from '../athlete-data';
import type { DateParts } from '../birth-date';
import type { ConfirmationRecord, RegistrationStatus } from '../confirm/plan';
import type { HistoryInput } from '../history';
import type { StoredMatchLevel } from '../matching';

/** Club data as the 3A+3B services see it. Ids are Strapi documentIds. `strapiClubStore` is the real one. */
export type AthleteRow = AthleteValues & { id: string; status: AthleteStatus; dataIncomplete: boolean; profileId: string | null; updatedAt: string };
export type RegistrationRow = {
  id: string; number: string | null; childName: string; childBirthDate: string; parentName: string; phone: string; email: string;
  status: RegistrationStatus; archived: boolean; season: string | null; seasonId: string | null; sectionId: string | null;
  athleteId: string | null; matchAthleteId: string | null; matchLevel: StoredMatchLevel | null; childBirthDateParsed: string | null;
  membershipAnswer: 'da' | 'nu' | null; lastSeason: string | null; subscriptionChoice: unknown; confirmation: ConfirmationRecord | null; submittedAt: string | null;
};
export type SeasonRow = { id: string; label: string; startMonth: string; endMonth: string; isCurrent: boolean };
export type SectionRow = { id: string; name: string; kind: 'school' | 'club'; publicPage: boolean; order: number | null };
export type GroupRow = { id: string; name: string; sectionId: string | null; order: number | null; active: boolean };
export type MembershipRow = { id: string; athleteId: string; groupId: string; seasonId: string; isMain: boolean; from: string | null };
export type AcsRow = { id: string; athleteId: string; seasonId: string; state: AcsState };
/** A possible-duplicate pair; `dismissed` after "Nu e același copil", kept so the pair is never flagged again. */
export type DuplicateRow = { id: string; firstId: string; secondId: string; dismissed: boolean };
/** One public profile; `showPublicPage` and `published` come from its published row. */
export type ProfileRow = { id: string; name: string; slug: string; previousSlugs: string[]; showPublicPage: boolean; published: boolean };
export type HistoryRow = { seq: number; subjectType: string; subjectId: string; action: string; changes: Record<string, unknown>; actor: string; at: string };

export type RegistrationPatch = Partial<{
  athleteId: string | null; matchAthleteId: string | null; matchLevel: StoredMatchLevel | null; childBirthDateParsed: string | null;
  status: RegistrationStatus; sectionId: string; confirmation: ConfirmationRecord | null;
}>;
export type AthleteWrite = Partial<AthleteValues & { status: AthleteStatus; dataIncomplete: boolean; profileId: string | null }>;

export interface ClubStore {
  /** All writes inside `work` are saved together or not at all. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
  /** Inside a transaction: holds the registration row until the transaction ends (concurrent confirm, spec 4.7). */
  lockRegistration(id: string): Promise<void>;
  registration(id: string): Promise<RegistrationRow | null>;
  registrations(where?: { athleteId?: string }): Promise<RegistrationRow[]>;
  athlete(id: string): Promise<AthleteRow | null>;
  athletes(): Promise<AthleteRow[]>;
  seasons(): Promise<SeasonRow[]>;
  sections(): Promise<SectionRow[]>;
  groups(): Promise<GroupRow[]>;
  memberships(athleteId?: string): Promise<MembershipRow[]>;
  acsRows(athleteId?: string): Promise<AcsRow[]>;
  /** Every pair, dismissed ones included. */
  duplicates(): Promise<DuplicateRow[]>;
  profiles(): Promise<ProfileRow[]>;
  history(subjectType: string, subjectId: string): Promise<HistoryRow[]>;
  historyByAction(action: string): Promise<HistoryRow[]>;
  adminNames(emails: string[]): Promise<Record<string, string>>;
  updateRegistration(id: string, patch: RegistrationPatch): Promise<void>;
  createAthlete(data: AthleteWrite): Promise<string>;
  updateAthlete(id: string, data: AthleteWrite): Promise<void>;
  deleteAthlete(id: string): Promise<void>;
  createMembership(data: Omit<MembershipRow, 'id'>): Promise<string>;
  updateMembership(id: string, data: Partial<Pick<MembershipRow, 'athleteId' | 'isMain'>>): Promise<void>;
  deleteMembership(id: string): Promise<void>;
  createAcs(data: Omit<AcsRow, 'id'>): Promise<string>;
  updateAcs(id: string, data: Partial<Pick<AcsRow, 'athleteId' | 'state'>>): Promise<void>;
  deleteAcs(id: string): Promise<void>;
  createDuplicate(firstId: string, secondId: string): Promise<void>;
  dismissDuplicate(id: string): Promise<void>;
  deleteDuplicate(id: string): Promise<void>;
  createProfile(name: string, slug: string): Promise<string>;
  /** Draft and published rows together, other draft edits untouched (gaps #38). */
  renameProfile(id: string, name: string): Promise<void>;
  setProfileVisibility(id: string, on: boolean): Promise<void>;
  setPreviousSlugs(id: string, slugs: string[]): Promise<void>;
  /** The profile with its competition participations (spec 6.6). */
  deleteProfile(id: string): Promise<void>;
  moveHistory(fromAthleteId: string, toAthleteId: string): Promise<void>;
  record(entry: HistoryInput): Promise<void>;
}

/** What every 3A+3B service gets from its controller. */
export type ServiceContext = { store: ClubStore; actor: string; today: DateParts; log: (message: string) => void };
