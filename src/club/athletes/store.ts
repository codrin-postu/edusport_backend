import type { AccessContext } from '../portal/access/context';
import type { AcsState } from '../acs';
import type { AthleteStatus, AthleteValues } from '../athlete-data';
import type { DateParts } from '../birth-date';
import type { ConfirmationRecord, RegistrationStatus } from '../confirm/plan';
import type { HistoryInput } from '../history';
import type { StoredMatchLevel } from '../matching';
import type { PersonalDataSettings } from '../personal-data/settings';
import type { RegistrationScrub } from '../personal-data/anonymize-plan';

/** Club data as the 3A+3B services see it. Ids are Strapi documentIds. `strapiClubStore` is the real one. */
export type AthleteRow = AthleteValues & {
  id: string; status: AthleteStatus; dataIncomplete: boolean; profileId: string | null; notes: string | null; updatedAt: string; createdAt: string; anonymizedAt: string | null;
};
export type RegistrationRow = {
  id: string; number: string | null; childName: string; childBirthDate: string; parentName: string; phone: string; email: string;
  status: RegistrationStatus; archived: boolean; season: string | null; seasonId: string | null; sectionId: string | null;
  athleteId: string | null; matchAthleteId: string | null; matchLevel: StoredMatchLevel | null; childBirthDateParsed: string | null;
  membershipAnswer: 'da' | 'nu' | null; lastSeason: string | null; subscriptionChoice: unknown; confirmation: ConfirmationRecord | null; submittedAt: string | null;
};
export type SeasonRow = { id: string; label: string; startMonth: string; endMonth: string; isCurrent: boolean };
export type SectionRow = { id: string; name: string; kind: 'school' | 'club'; publicPage: boolean; order: number | null };
export type GroupRow = { id: string; name: string; sectionId: string | null; order: number | null; active: boolean };
/** `to` is the last day of an ended membership; null (or absent in old test seeds) while current (spec 3.2). */
export type MembershipRow = { id: string; athleteId: string; groupId: string; seasonId: string; isMain: boolean; from: string | null; to?: string | null };
export type AcsRow = { id: string; athleteId: string; seasonId: string; state: AcsState };
/** A possible-duplicate pair; `dismissed` after "Nu e același copil", kept so the pair is never flagged again. */
export type DuplicateRow = { id: string; firstId: string; secondId: string; dismissed: boolean };
/** One public profile; `showPublicPage` and `published` come from its published row. */
export type ProfileRow = { id: string; name: string; slug: string; previousSlugs: string[]; showPublicPage: boolean; published: boolean;
  /** The athlete's slug in skate-results (the profile's `skateResultsSlug`), absent without one. */
  skateResultsSlug?: string;
};
export type HistoryRow = { seq: number; subjectType: string; subjectId: string; action: string; changes: Record<string, unknown>; actor: string; at: string };

export type RegistrationPatch = Partial<{
  athleteId: string | null; matchAthleteId: string | null; matchLevel: StoredMatchLevel | null; childBirthDateParsed: string | null;
  status: RegistrationStatus; sectionId: string; confirmation: ConfirmationRecord | null;
}>;
export type AthleteWrite = Partial<AthleteValues & {
  status: AthleteStatus; dataIncomplete: boolean; profileId: string | null; notes: string | null; firstName: null; lastName: null; anonymizedAt: string | null;
}>;
/** One e-mail job as the 3C tests see it (fake state); the services only call `scrubEmailJobs`. */
export type ClubEmailJob = { id: string; registrationId: string | null; recipient: string | null; subject: string | null; status: string; lastError: string | null; kind?: 'registration' | 'schedule-change' | 'payment'; paymentId?: string | null; payload?: unknown };

export interface ClubStore {
  /** All writes inside `work` are saved together or not at all. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
  /** Inside a transaction: holds the registration row until the transaction ends (concurrent confirm, spec 4.7). */
  lockRegistration(id: string): Promise<void>;
  /** Inside a transaction: holds the athlete row until the transaction ends (two confirmations of one child, a merge, polish 12). */
  lockAthlete(id: string): Promise<void>;
  /** Season row lock, taken after the registration and before any athlete (membership and A.C.S. inserts key-share it). */
  lockSeason(id: string): Promise<void>;
  registration(id: string): Promise<RegistrationRow | null>;
  /** Linked to (`athleteId`) or matched with (`matchAthleteId`) one athlete; both given: both must hold. */
  registrations(where?: { athleteId?: string; matchAthleteId?: string }): Promise<RegistrationRow[]>;
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
  createMembership(data: Omit<MembershipRow, 'id' | 'to'>): Promise<string>;
  updateMembership(id: string, data: Partial<Pick<MembershipRow, 'athleteId' | 'isMain'>>): Promise<void>;
  deleteMembership(id: string): Promise<void>;
  createAcs(data: Omit<AcsRow, 'id'>): Promise<string>;
  updateAcs(id: string, data: Partial<Pick<AcsRow, 'athleteId' | 'state'>>): Promise<void>;
  deleteAcs(id: string): Promise<void>;
  /** `dismissed` lets a merge re-create a pair the admin already dismissed. */
  createDuplicate(firstId: string, secondId: string, dismissed?: boolean): Promise<void>;
  dismissDuplicate(id: string): Promise<void>;
  deleteDuplicate(id: string): Promise<void>;
  createProfile(name: string, slug: string): Promise<string>;
  /** Draft and published rows together, other draft edits untouched (gaps #38). */
  renameProfile(id: string, name: string): Promise<void>;
  setProfileVisibility(id: string, on: boolean): Promise<void>;
  setPreviousSlugs(id: string, slugs: string[]): Promise<void>;
  /** The profile with its competition participations (spec 6.6). */
  deleteProfile(id: string): Promise<void>;
  /** Media Library file ids in the profile's media fields, draft and published rows (3C spec 4). */
  profileMediaIds(profileId: string): Promise<number[]>;
  /** Deletes the file (row, stored file and formats) when no content uses it any more; false when it is kept or gone. */
  deleteMediaIfUnused(fileId: number): Promise<boolean>;
  moveHistory(fromAthleteId: string, toAthleteId: string): Promise<void>;
  record(entry: HistoryInput): Promise<void>;
  /** Raw registration rows of one athlete (every attribute), for the export summary (3C spec 3). */
  registrationRecords(athleteId: string): Promise<Record<string, unknown>[]>;
  /** Registrations linked to an anonymized athlete: the startup sweep of their PDF folders (3C spec 4). */
  anonymizedRegistrationIds(): Promise<string[]>;
  /** Replaces one history row's `changes` (3C scrubbing); `seq` is HistoryRow.seq. */
  setHistoryChanges(seq: number, changes: Record<string, unknown>): Promise<void>;
  /** Writes the 3C scrub on a registration, required form fields included; lifecycles (Sheet row) still run. */
  scrubRegistration(id: string, data: RegistrationScrub): Promise<void>;
  /** E-mail jobs of these registrations: recipient, subject and lastError cleared, a queued job cancelled. */
  scrubEmailJobs(registrationIds: string[]): Promise<void>;
  /** Schedule-change e-mail jobs (no registration link) whose recipient is one of these addresses, compared without case: same scrub as `scrubEmailJobs`. */
  scrubScheduleEmailJobs(addresses: string[]): Promise<void>;
  /** Payment e-mail jobs linked to these payments: recipient, subject, lastError, payload null; queued -> cancelled (decided 8). */
  scrubPaymentEmailJobs(paymentIds: string[]): Promise<void>;
  /** site-settings.personalData as stored (read it with `readPersonalDataSettings`). */
  personalDataSettings(): Promise<unknown>;
  savePersonalDataSettings(value: PersonalDataSettings): Promise<void>;
}

/** What every 3A+3B service gets from its controller. */
export type ServiceContext = {
  store: ClubStore; actor: string; today: DateParts; log: (message: string) => void;
  /** Portal access (7-1): when set, an e-mail change, a delete, an anonymize and a merge carry the athlete's access along. Tests of the club side leave it out. */
  access?: AccessContext;
};
