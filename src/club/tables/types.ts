export type Subject = 'sportivi' | 'plati' | 'abonamente' | 'prezenta';
export type ColumnType = 'text' | 'number' | 'money' | 'date' | 'label';
/** `values` lists the words a label column can show; absent for labels that are data (group, section names). */
export type CatalogColumn = { key: string; label: string; type: ColumnType; values?: string[] };
export type FilterOp = 'eq' | 'in' | 'gt' | 'lt' | 'empty' | 'notEmpty';
export type GroupKey = 'grupa' | 'sectiune' | 'luna' | 'antrenor';
/** null: the season; `current`: the month of today; `month`: that month. */
export type PeriodSpec = null | { kind: 'month'; month: string } | { kind: 'current' };
export type FilterValue = string | number | string[];
export type TableFilter = { column: string; op: FilterOp; value?: FilterValue };
export type TableDefinition = {
  subject: Subject;
  scope: { seasonId: string; sectionId: string | null; groupId: string | null; period: PeriodSpec };
  columns: string[];
  filters: TableFilter[];
  groupBy: GroupKey | null;
  sort: { column: string; dir: 'asc' | 'desc' } | null;
};
export type CellValue = string | number | null;
export type TableRow = {
  athleteId: string | null;
  groupKeys: Partial<Record<GroupKey, { key: string; label: string }[]>>;
  cells: Record<string, CellValue>;
};
export type SavedViewRow = {
  id: string; name: string; subject: Subject; definition: TableDefinition;
  authorId: string | null; authorName: string; mine: boolean; canDelete: boolean; readyMade: boolean;
  /** Set when a stored view had to be repaired on load (a column the catalog no longer has); the screen shows them. */
  notices?: string[];
};
export type TableTotals = Record<string, CellValue>;
export type TableGroup = { key: string; label: string; count: number; subtotal: Record<string, CellValue>; rows: TableRow[] };
/** What a query answers. `subject` and `groupBy` ride along so the file shapes need no second argument. */
export type TableResult = {
  subject: Subject; groupBy: GroupKey | null; columns: CatalogColumn[];
  groups: TableGroup[] | null; rows: TableRow[]; total: TableTotals; count: number; notices: string[];
};
