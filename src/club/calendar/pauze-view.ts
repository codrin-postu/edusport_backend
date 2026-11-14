import { GROUP_ERRORS, SCHEDULE_ERRORS } from '../groups/copy';
import { isIsoDate, shortDate } from '../groups/dates';
import type { BreakRecord } from '../groups/types';

/** Pauze (spec 7.1). Pure. */
export type BreakDraft = { label: string; startDate: string; endDate: string; exceptGroupIds: string[] };

export const breakRows = (list: BreakRecord[]): (BreakRecord & { from: string; to: string })[] =>
  [...list].sort((a, b) => a.startDate.localeCompare(b.startDate)).map((b) => ({ ...b, from: shortDate(b.startDate), to: shortDate(b.endDate) }));
export const breakPhoneLine = (b: BreakRecord): string => `${shortDate(b.startDate)} - ${shortDate(b.endDate)}`;
/** Both dates valid and in order: the impact can be asked. */
export const impactAsked = (d: BreakDraft): boolean => isIsoDate(d.startDate) && isIsoDate(d.endDate) && d.endDate >= d.startDate;
export const emptyBreakDraft = (): BreakDraft => ({ label: '', startDate: '', endDate: '', exceptGroupIds: [] });
export const draftOfBreak = (b: BreakRecord): BreakDraft => ({ label: b.label, startDate: b.startDate, endDate: b.endDate, exceptGroupIds: b.exceptGroupIds ?? [] });

export function breakFormError(d: BreakDraft): string | null {
  if (!d.label.trim()) return GROUP_ERRORS.nameRequired;
  if (!isIsoDate(d.startDate) || !isIsoDate(d.endDate)) return GROUP_ERRORS.invalid;
  return d.endDate < d.startDate ? SCHEDULE_ERRORS.endBeforeStart : null;
}

export const breakBody = (d: BreakDraft): BreakDraft => ({ label: d.label.trim(), startDate: d.startDate, endDate: d.endDate, exceptGroupIds: d.exceptGroupIds });
