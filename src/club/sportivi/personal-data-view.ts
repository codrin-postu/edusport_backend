import type { AthleteStatus } from '../athlete-data';
import { ADMIN_ERRORS } from '../athletes/errors';
import { errorStatus } from '../inscrieri-confirm';
import { PERSONAL_DATA_COPY as C } from '../personal-data/copy';
import { requestErrorText } from '../registration-panel';
import { menuItems, type MenuKey } from './record-view';

/** Rules of the 3C admin screens (record menu, confirmation, export). Pure: the admin bundle imports it. */
export type RecordMenuKey = MenuKey | 'export' | 'anonymize';
export type RecordMenuItem = { key: RecordMenuKey; label: string };

/** "..." menu (spec 6.1 + 3C spec 3, 4): export for every admin, anonymize only for a Super Admin, none when anonymized. */
export function recordMenuItems(status: AthleteStatus, superAdmin: boolean): RecordMenuItem[] {
  if (status === 'anonimizat') return [];
  const [statusItem, merge, remove] = menuItems(status);
  const data: RecordMenuItem[] = [{ key: 'export', label: C.menu.export }];
  if (superAdmin) data.push({ key: 'anonymize', label: C.menu.anonymize });
  return [statusItem, merge, ...data, remove];
}

/** The confirmation's short lines (spec 4): what is removed, what stays, no undo. */
export const anonymizeLines = (): string[] => [C.dialog.removed, C.dialog.kept, C.dialog.final];

/** The confirmation's error: the server's text for 409 (already anonymized, stale); the shared text otherwise, never a raw 403/500 message. */
export const anonymizeErrorText = (err: unknown): string => (errorStatus(err) === 409 ? requestErrorText(err, ADMIN_ERRORS.stale) : ADMIN_ERRORS.failed);

export const EXPORT_FALLBACK_NAME = 'date.zip';
export const exportUrl = (documentId: string): string => `/api/club/athletes/${encodeURIComponent(documentId)}/export`;
