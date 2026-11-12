/** JSON shapes of the sportiv routes (index 7, spec sportiv app). Imports nothing: the frontend copies this file verbatim. */
export type SectionKind = 'school' | 'club';
export type SportivMe = { email: string; name: string | null; phone: string | null; hasPassword: boolean; google: boolean; passwordChangedAt: string | null; notifySchedule: boolean; devices: number };
export type PortalDevice = { id: string; label: string; lastSeenAt: string; current: boolean; twoFactorUntil: string | null }; // same shape as CoachDevice
export type SportivAthleteRow = { id: string; name: string; firstName: string; groupName: string | null; age: number | null; section: SectionKind | null; inPicker: boolean; performance: boolean };
export type SportivAthletes = { athletes: SportivAthleteRow[] };
export type CalendarKind = 'grupa' | 'individual' | 'concurs';
export type CalendarItem = { date: string; startTime: string | null; endTime: string | null; kind: CalendarKind; title: string; location: string | null; coaches: string[]; cancelled: boolean; note: string | null };
export type MonthBar = { month: string; count: number | null; state: 'past' | 'current' | 'future' };
export type Level = { groupId: string; groupName: string; sectionName: string; section: SectionKind; location: string | null };
export type AbonamentShort = { code: string | null; next: number; slots: number; validUntil: string };
export type CompetitionRow = { resultId: string; eventName: string; date: string | null; location: string | null; category: string; categoryShort: string; placement: number | null; total: number | null };
export type LastCompetition = { available: false } | { available: true; stale: boolean; updatedAt: string; row: CompetitionRow; field: number | null };
export type Promotion = { from: string; to: string };
export type SportivHome = {
  athlete: { id: string; name: string; firstName: string; age: number | null; inactive: boolean };
  level: Level | null; category: string | null; seasonLabel: string | null;
  presences: { total: number; months: MonthBar[] }; upcoming: CalendarItem[];
  abonament: AbonamentShort | null; lastCompetition: LastCompetition | null; promotion: Promotion | null;
};
export type SportivProfile = { name: string; birthDate: string | null; age: number | null; contactName: string | null; phone: string | null; email: string | null };
export type HistoryRow = { date: string; startTime: string | null; kind: 'Grup' | 'Individual'; groupName: string | null; coaches: string[] };
export type SportivHistory = { seasonLabel: string | null; total: number; group: number; individual: number; page: number; pageSize: 20; rows: HistoryRow[] };
export type SportivCalendar = { month: string; prevMonth: string | null; nextMonth: string | null; items: CalendarItem[] };
export type BadgeKey = 'antrenamente' | 'sezon' | 'prima' | 'concursuri';
export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'ice';
export type Badge = { key: BadgeKey; tier: Tier | null; label: string; count: number; next: number | null; tiers: { threshold: number; tier: Tier; reachedOn: string | null }[] };
export type SportivPath = {
  now: { groupName: string; since: string; location: string | null; program: string | null } | null;
  next: { groupName: string } | null; before: { groupName: string; from: string; to: string }[]; badges: Badge[];
};
export type MoneyLine = { text: string; amount: number };
export type SportivMoney = { left: number; lines: MoneyLine[]; advance: number | null; abonament: (AbonamentShort & { itemName: string; startsOn: string }) | null; document: { seasonLabel: string } | null };
export type PaymentRow = { what: string; paidOn: string; method: 'numerar' | 'card' | 'transfer'; amount: number };
export type SportivPayments = { page: number; pageSize: 20; total: number; rows: PaymentRow[] };
export type Ticket = { code: string | null; itemName: string; startsOn: string; validUntil: string; slots: number; used: string[]; left: number };
export type SportivSubscriptions = { active: Ticket | null; earlier: { itemName: string; used: number; slots: number; validUntil: string }[] };
export type CompetitionSort = 'recent' | 'place' | 'points';
export type SportivCompetitions = { available: false } | {
  available: true; stale: boolean; updatedAt: string; total: number;
  category: { current: string; seasonLabel: string; previous: { short: string; sinceYear: number } | null } | null;
  records: { best: number | null; podiums: number; wins: number }; seasons: string[]; page: number; pageSize: 20; filtered: number; rows: CompetitionRow[];
};
export type Segment = { name: string; isShort: boolean; score: number | null; tes: number | null; pcs: number | null; deductions: number | null; elements: { name: string; base: number | null; score: number | null }[] };
export type SportivCompetition = { available: false } | {
  available: true; stale: boolean; updatedAt: string; row: CompetitionRow; field: number | null; best: number | null; segments: Segment[]; officialUrl: string | null;
};
