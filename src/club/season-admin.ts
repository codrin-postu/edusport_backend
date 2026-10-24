import { changedFields, type FieldChange } from './admin-result';
import { normalizeSeasonLabel } from './season';

/** A season as the Sezoane drawer edits it. Months are 'YYYY-MM'. */
export type SeasonFields = { label: string; startMonth: string; endMonth: string; membershipFee: number | null };
/** A row of the Sezoane table. `registrations` > 0 locks the label. */
export type AdminSeason = SeasonFields & { documentId: string; isCurrent: boolean; registrations: number };
export type RawAdminSeason = { documentId?: unknown; label?: unknown; startMonth?: unknown; endMonth?: unknown; membershipFee?: unknown; isCurrent?: unknown };
/** What is written to `api::season.season`: dates, never months. */
export type SeasonWriteData = { label: string; startMonth: string; endMonth: string; membershipFee: number | null };

export const MONTH_NAMES = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
] as const;

export const SEASON_ERRORS = {
  label: 'Sezonul se scrie ca 2026-2027.',
  months: 'Alege luna de început și de sfârșit.',
  order: 'Sfârșitul trebuie să fie după început.',
  fee: 'Taxa de membru nu este validă.',
  missing: 'Sezonul nu mai există.',
  locked: 'Sezonul are înscrieri, numele lui nu se mai schimbă.',
} as const;

export const seasonExistsError = (label: string) => `Sezonul ${label} există deja.`;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const FIELDS = ['label', 'startMonth', 'endMonth', 'membershipFee'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFee = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const isMonth = (v: unknown): v is string => typeof v === 'string' && MONTH_RE.test(v);

/** '2026-10-04' -> '2026-10'; '' for anything that is not a date. */
export function monthOf(date: unknown): string {
  const m = typeof date === 'string' ? /^(\d{4}-\d{2})-\d{2}/.exec(date) : null;
  return m && isMonth(m[1]) ? m[1] : '';
}

/** '2026-10' -> 'Octombrie 2026'. */
export function formatMonth(month: string): string {
  const m = MONTH_RE.exec(month);
  return m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : '';
}

/** 'Octombrie 2026 - Mai 2027'. */
export function formatPeriod(startMonth: string, endMonth: string): string {
  return [formatMonth(startMonth), formatMonth(endMonth)].filter(Boolean).join(' - ');
}

function seasonInputError(body: Record<string, unknown>): string | null {
  const label = text(body.label);
  if (normalizeSeasonLabel(label) !== label) return SEASON_ERRORS.label;
  if (!isMonth(body.startMonth) || !isMonth(body.endMonth)) return SEASON_ERRORS.months;
  if (body.endMonth <= body.startMonth) return SEASON_ERRORS.order;
  const fee = body.membershipFee;
  return fee === null || fee === undefined || isFee(fee) ? null : SEASON_ERRORS.fee;
}

/** The drawer's body, checked: label 'YYYY-YYYY' (consecutive years), months, end after start, fee >= 0 or empty. */
export function readSeasonInput(raw: unknown): { ok: true; season: SeasonFields } | { ok: false; error: string } {
  const body = isRecord(raw) ? raw : {};
  const error = seasonInputError(body);
  if (error) return { ok: false, error };
  const membershipFee = isFee(body.membershipFee) ? body.membershipFee : null;
  return { ok: true, season: { label: text(body.label), startMonth: String(body.startMonth), endMonth: String(body.endMonth), membershipFee } };
}

export function toSeasonFields(raw: RawAdminSeason): SeasonFields {
  const membershipFee = isFee(raw.membershipFee) ? raw.membershipFee : null;
  return { label: text(raw.label), startMonth: monthOf(raw.startMonth), endMonth: monthOf(raw.endMonth), membershipFee };
}

export function toAdminSeason(raw: RawAdminSeason, registrations: number): AdminSeason | null {
  if (typeof raw.documentId !== 'string' || !text(raw.label)) return null;
  return { ...toSeasonFields(raw), documentId: raw.documentId, isCurrent: raw.isCurrent === true, registrations };
}

/** Newest season first. */
export const byNewest = (a: { label: string }, b: { label: string }) => b.label.localeCompare(a.label);

const lastDay = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * Dates to store. A month the admin did not change keeps its stored date (old seasons may start on
 * a given day); a changed month starts on the 1st or ends on its last day.
 */
export function seasonWriteData(fields: SeasonFields, stored: RawAdminSeason | null): SeasonWriteData {
  const keep = (month: string, date: unknown, fallback: string) => (monthOf(date) === month ? String(date) : fallback);
  return {
    label: fields.label,
    startMonth: keep(fields.startMonth, stored?.startMonth, `${fields.startMonth}-01`),
    endMonth: keep(fields.endMonth, stored?.endMonth, `${fields.endMonth}-${lastDay(fields.endMonth)}`),
    membershipFee: fields.membershipFee,
  };
}

export function seasonChanges(before: SeasonFields | null, after: SeasonFields): Record<string, FieldChange> {
  return changedFields<SeasonFields>(FIELDS, before, after);
}

const shiftYear = (month: string) => (isMonth(month) ? `${Number(month.slice(0, 4)) + 1}${month.slice(4)}` : '');

/** "+ Sezon nou" starts from the newest season, one year later; with none, October to May from this year. */
export function nextSeasonDraft(seasons: SeasonFields[], today: Date = new Date()): SeasonFields {
  const newest = [...seasons].sort(byNewest)[0];
  const start = newest ? Number(newest.label.slice(0, 4)) + 1 : today.getFullYear();
  return {
    label: `${start}-${start + 1}`,
    startMonth: shiftYear(newest?.startMonth ?? '') || `${start}-10`,
    endMonth: shiftYear(newest?.endMonth ?? '') || `${start + 1}-05`,
    membershipFee: newest?.membershipFee ?? null,
  };
}

function optionYears(label: string, selected: string[], today: Date): number[] {
  const years = new Set<number>();
  const normalized = normalizeSeasonLabel(label);
  if (normalized === label) [0, 1].forEach((d) => years.add(Number(label.slice(0, 4)) + d));
  selected.filter(isMonth).forEach((m) => years.add(Number(m.slice(0, 4))));
  if (years.size === 0) [0, 1].forEach((d) => years.add(today.getFullYear() + d));
  return [...years].sort((a, b) => a - b);
}

/** Months offered by Început / Sfârșit: every month of the season's two years, plus the selected ones. */
export function monthOptions(label: string, selected: string[], today: Date = new Date()): { value: string; label: string }[] {
  return optionYears(label, selected, today).flatMap((year) =>
    MONTH_NAMES.map((_, i) => {
      const value = `${year}-${String(i + 1).padStart(2, '0')}`;
      return { value, label: formatMonth(value) };
    }),
  );
}
