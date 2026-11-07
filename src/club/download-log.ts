/** The log line of a file download: who and what kind, row count only. No names, no file names (S62). */
export const downloadLogLine = (i: { adminId: string | number | null; kind: string; rows: number }): string =>
  `[download] admin=${i.adminId ?? 'unknown'} kind=${i.kind} rows=${i.rows}`;
