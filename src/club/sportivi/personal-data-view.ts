import type { AthleteStatus } from '../athlete-data';
import { ADMIN_ERRORS } from '../athletes/errors';
import { errorStatus } from '../inscrieri-confirm';
import { MAX_BULK, type BulkAnonymizeResult } from '../personal-data/anonymize-plan';
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

/** Checkboxes and the bulk bar: only a Super Admin, only on the inactivity list (3C spec 5). */
export const selectionOn = (inactiveFilterOn: boolean, superAdmin: boolean): boolean => inactiveFilterOn && superAdmin;

export function toggled(ids: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export const allSelected = (ids: ReadonlySet<string>, rowIds: string[]): boolean => rowIds.length > 0 && rowIds.every((id) => ids.has(id));

/** "Selectează tot": ticks every row shown, or unticks them when all are ticked. */
export function toggledAll(ids: ReadonlySet<string>, rowIds: string[]): Set<string> {
  if (allSelected(ids, rowIds)) return new Set([...ids].filter((id) => !rowIds.includes(id)));
  return new Set([...ids, ...rowIds]);
}

/** The route takes at most 200 ids; a bigger selection goes in turns (decided while planning, item 10). */
export function chunks(ids: string[], size: number = MAX_BULK): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export const addResults = (a: BulkAnonymizeResult, b: BulkAnonymizeResult): BulkAnonymizeResult => ({
  anonymized: a.anonymized + b.anonymized, skipped: a.skipped + b.skipped, failed: a.failed + b.failed,
});

const countParts = (r: BulkAnonymizeResult): string[] => [r.skipped ? C.skipped(r.skipped) : '', r.failed ? C.failed(r.failed) : ''];

/** "k sportivi anonimizați." plus "Sărite: n." / "Nereușite: n." when not zero (spec 5). */
export const bulkToast = (r: BulkAnonymizeResult): string => [C.done(r.anonymized), ...countParts(r)].filter(Boolean).join(' ');

/** What a bulk run did: the ids of the requests that answered, and whether a later request failed. */
export type BulkRun = { result: BulkAnonymizeResult; doneIds: string[]; stopped: boolean; error: unknown };

/** The chunks in turn; the first failed request stops the run and keeps what the earlier ones did. */
export async function anonymizeInTurns(send: (ids: string[]) => Promise<BulkAnonymizeResult>, ids: string[]): Promise<BulkRun> {
  let result: BulkAnonymizeResult = { anonymized: 0, skipped: 0, failed: 0 };
  const doneIds: string[] = [];
  for (const part of chunks(ids)) {
    try {
      result = addResults(result, await send(part));
    } catch (error) {
      return { result, doneIds, stopped: true, error };
    }
    doneIds.push(...part);
  }
  return { result, doneIds, stopped: false, error: null };
}

/**
 * "Oprit după k sportivi anonimizați." plus the counts; the generic error text says nothing was saved,
 * so only a 409's own text is added.
 */
export const stoppedToast = (run: BulkRun): string =>
  [C.stopped(run.result.anonymized), ...countParts(run.result), errorStatus(run.error) === 409 ? anonymizeErrorText(run.error) : '']
    .filter(Boolean).join(' ');

/** The one toast after a run that did something: a warning when a request stopped or some ids failed. */
export function runToast(run: BulkRun): { warning: boolean; text: string } {
  if (run.stopped) return { warning: true, text: stoppedToast(run) };
  return { warning: run.result.failed > 0, text: bulkToast(run.result) };
}

/** The ticked ids left after a run: the ones whose request never answered. */
export const withoutIds = (ids: ReadonlySet<string>, doneIds: string[]): Set<string> => new Set([...ids].filter((id) => !doneIds.includes(id)));
