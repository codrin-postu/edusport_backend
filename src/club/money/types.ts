/** Section id of the "Fără grupă" block: the money of athletes with no group. */
export const NO_GROUP = '';

/** Datorat, Încasat, Rămas and the rounded percent; `percent` is null when Datorat is 0 (S56). */
export type Money4 = { due: number; paid: number; left: number; percent: number | null };
export type SectionBlock = {
  sectionId: string; sectionName: string; totals: Money4; groups: { groupId: string; groupName: string; totals: Money4 }[];
};
/** One row of the Metodă and Scop breakdowns: Încasat and the number of non-cancelled payments. */
export type TallyRow = { key: string; label: string; paid: number; count: number };
export type MoneyCards = {
  collected: number; collectedPrev: number; left: number; due: number; activeSubscriptions: number; schoolAthletes: number; expiring: number; unpaidAthletes: number;
};
export type MoneyOverview = { month: string; cards: MoneyCards; bySection: SectionBlock[]; byMethod: TallyRow[]; byPurpose: TallyRow[] };
