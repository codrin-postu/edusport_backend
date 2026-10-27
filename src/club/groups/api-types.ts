/** JSON shapes of the 06-groups routes (spec 8.2). The admin UI (plan 4-5) reads these. */
export type SeasonRef = { documentId: string; label: string; past: boolean };
export type SeasonChoice = { documentId: string; label: string; isCurrent: boolean };
export type NamedRef = { documentId: string; name: string };
export type SectionTab = { documentId: string; slug: string; label: string; count: number };
export type GroupListRow = { documentId: string; name: string; program: string[]; coaches: string[]; members: number };
export type GroupListPage = {
  season: SeasonRef | null; seasons: SeasonChoice[]; tabs: SectionTab[]; section: string | null;
  /** Distinct athletes with a current membership in the tab's groups, and the number of groups (the line under the tabs). */
  athletes: number; groups: number; rows: GroupListRow[]; unassigned: number;
};
export type GroupChoice = { documentId: string; name: string; sectionName: string };
export type UnassignedRow = { athleteId: string; name: string; source: string; proposedGroupId: string | null };
export type UnassignedPage = { season: SeasonRef | null; rows: UnassignedRow[]; groups: GroupChoice[] };
export type MemberRow = { membershipId: string; athleteId: string; name: string; age: number | null; isMain: boolean; others: { name: string; isMain: boolean }[] };
/** Empty-tab copies (10.6, 10.9): `members` and `program` are what the tab can copy from `season`; `programFrom` the "Se repetă din" date. */
export type CopyFrom = { season: string; members: number; inactive: number; program: string[]; programFrom: string | null };
export type GroupPage = {
  documentId: string; name: string; section: (NamedRef & { kind: 'school' | 'club' }) | null; priceList: NamedRef | null; coaches: NamedRef[];
  programPublic: boolean; season: SeasonRef | null; members: MemberRow[]; historyCount: number; deletable: boolean; copyFrom?: CopyFrom | null;
};
export type GroupOptions = { groups: GroupChoice[]; coaches: NamedRef[]; priceLists: (NamedRef & { sectionId: string | null })[] };
export type JoinResult = { added: number; athleteNames: string[]; groupName: string };
export type AllocateResult = { allocated: number };
export type MoveResult = { athleteName: string; groupName: string };
/** Every write route answers this (spec 8.2): `undo` is null when the action wrote nothing to take back. */
export type ActionBody<T> = { data: T; undo: { actionId: string } | null };
