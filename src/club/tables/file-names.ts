import type { Subject } from './types';

/** Names of the downloads: the subject and the day, never a person or a filter value (S62). */
export const xlsxName = (subject: Subject, today: string): string => `tabel-${subject}-${today}.xlsx`;
export const csvName = (subject: Subject, today: string): string => `tabel-${subject}-${today}.csv`;
