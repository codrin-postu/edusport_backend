import type { AcsState } from '../acs';
import type { AthleteField, AthleteStatus } from '../athlete-data';
import type { ComparisonRow } from '../confirm/compare';
import type { RegistrationStatus } from '../confirm/plan';

/** JSON the 3A+3B admin routes answer, inside `{ data }`. The admin UI plans import these types. */

/** A two-line athlete row or card: name, then birth date (ZZ.LL.AAAA), last group, parent. */
export type AthleteCard = {
  documentId: string;
  name: string;
  birthDate: string | null;
  lastGroup: { name: string; season: string } | null;
  lastRegistrationSeason: string | null;
  contactName: string | null;
  status: AthleteStatus;
};

/** GET /api/club/registrations/:documentId/match: the panel's match card and the window's start. */
export type RegistrationMatchView = {
  confirmed: boolean;
  athleteId: string | null;
  canConfirm: boolean;
  canUndo: boolean;
  birthDateReadable: boolean;
  notAttendedLastSeason: boolean;
  existing: AthleteCard | null;
  preselect: 'existing' | null;
  comparison: ComparisonRow[];
  candidates: AthleteCard[];
};

export type GroupOption = { documentId: string; name: string };
export type GroupSection = { sectionId: string; sectionName: string; groups: GroupOption[] };

/** GET /api/club/registrations/:documentId/confirm-context?athlete=: everything the confirm window shows for one choice. */
export type ConfirmContext = {
  registrationNumber: string | null;
  newAthlete: { name: string; birthDate: string | null };
  season: { label: string | null; running: boolean; endedText: string | null };
  groups: GroupSection[];
  mainGroupNow: { name: string; sectionName: string } | null;
  acs: { seasonLabel: string | null; current: AcsState | null; next: AcsState | null; wish: 'da' | 'nu' | null };
  subscriptionIntent: string | null;
  comparison: ComparisonRow[];
  defaultUpdateFields: AthleteField[];
  blocked: 'confirmed' | 'not-confirmable' | 'birth-date' | null;
};

export type ConfirmResponse = { athleteId: string; athleteName: string; registrationId: string };
export type UndoResponse = { status: RegistrationStatus; athleteDeleted: boolean };
export type MoveSchoolResponse = { moved: number; skipped: number };
export type HistoryLine = { at: string; actor: string; text: string };

/** One row of GET /api/club/athletes. `missing` may be empty while `dataIncomplete` is true (deploy-marked records). */
export type AthleteListRow = {
  documentId: string;
  name: string;
  age: number | null;
  birthDate: string | null;
  status: AthleteStatus;
  dataIncomplete: boolean;
  missing: string[];
  mainGroup: { documentId: string; name: string } | null;
  contactName: string | null;
  phone: string | null;
  acs: AcsState;
  publicProfile: 'public' | 'ascuns';
  possibleDuplicate: boolean;
  abonament: string | null;
};

export type AthleteListPage = {
  data: AthleteListRow[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  unfiltered: number;
  incomplete: number;
  season: { documentId: string; label: string } | null;
  seasons: { documentId: string; label: string; isCurrent: boolean }[];
  options: { sections: { value: string; label: string }[]; groups: { value: string; label: string; sectionName: string }[] };
  retentionYears: number;
};

export type AthleteRecord = {
  documentId: string;
  fields: Record<AthleteField, string | null>;
  missing: AthleteField[];
  status: AthleteStatus;
  dataIncomplete: boolean;
  header: { birthDate: string | null; mainGroup: string | null };
  season: { documentId: string; label: string } | null;
  acs: { seasonLabel: string | null; state: AcsState };
  registrations: { documentId: string; number: string | null; season: string | null; status: RegistrationStatus }[];
  documents: { registrationDocumentId: string; kind: 'acord' | 'adeziune'; label: string }[];
  profile: { documentId: string; slug: string; showPublicPage: boolean } | null;
  duplicates: { pairId: string; documentId: string; name: string }[];
  historyCount: number;
};

export type AthleteEditResponse = { record: AthleteRecord; changed: AthleteField[] };

export type MergeSideView = { documentId: string; name: string; fields: Record<AthleteField, string>; status: AthleteStatus; profileSlug: string | null; registrations: number };
export type MergePreview = { kept: MergeSideView; removed: MergeSideView; differing: AthleteField[] };
