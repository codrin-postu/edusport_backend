import { zipSync } from 'fflate';
import { isoDate, todayInBucharest } from '../birth-date';
import { slugify } from '../profile-slug';

/** One registration PDF in the ZIP: `inscrieri/<folder>/<fileName>`, the folder being the registration number. */
export type ZipEntry = { folder: string; fileName: string; data: Uint8Array };

/** `date-<slug-of-name>-<YYYY-MM-DD>.zip`, the date in Bucharest (spec 3). */
export const exportFileName = (name: string | null, now: Date): string => `date-${slugify(name ?? '')}-${isoDate(todayInBucharest(now))}.zip`;

/** Built in memory (spec 3): `rezumat.pdf` at the root, each registration's stored PDFs under `inscrieri/<nr>/`. */
export function zipExport(summary: Uint8Array, entries: ZipEntry[]): Uint8Array {
  const folders: Record<string, Record<string, Uint8Array>> = {};
  for (const e of entries) folders[e.folder] = { ...folders[e.folder], [e.fileName]: e.data };
  return zipSync({ 'rezumat.pdf': summary, ...(entries.length ? { inscrieri: folders } : {}) });
}

/** Never cached, never indexed, saved under its own name (like the registration PDFs). */
export function zipHeaders(fileName: string): Record<string, string> {
  return {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
  };
}
