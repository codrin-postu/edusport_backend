import { slugify } from '../profile-slug';
import type { Subject } from './types';

/** The part before the day: the slug of the view name, else `tabel-<subject>`. Never a person or a filter value (S62). */
function base(subject: Subject, name?: string): string {
  const letters = (name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /[a-z0-9]/i.test(letters) ? slugify(letters) : `tabel-${subject}`;
}

export const xlsxName = (subject: Subject, today: string, name?: string): string => `${base(subject, name)}-${today}.xlsx`;
export const csvName = (subject: Subject, today: string, name?: string): string => `${base(subject, name)}-${today}.csv`;
