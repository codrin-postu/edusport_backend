import { normalizeSeasonLabel, seasonStartYear } from './season';

export function formatRegistrationNumber(startYear: number, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > 9999) {
    throw new RangeError(`Registration sequence out of range: ${seq}`);
  }
  return `${startYear}-${String(seq).padStart(4, '0')}`;
}

export function parseRegistrationNumber(
  value: string | null | undefined,
): { startYear: number; seq: number } | null {
  const m = /^(\d{4})-(\d{4})$/.exec(value ?? '');
  if (!m) return null;
  return { startYear: Number(m[1]), seq: Number(m[2]) };
}

/** Highest sequence already used for `startYear` in any of `numbers` (any season), plus one. */
export function nextRegistrationNumber(numbers: (string | null | undefined)[], startYear: number): string {
  let max = 0;
  for (const value of numbers) {
    const parsed = parseRegistrationNumber(value);
    if (parsed && parsed.startYear === startYear) max = Math.max(max, parsed.seq);
  }
  return formatRegistrationNumber(startYear, max + 1);
}

export interface BackfillRow {
  documentId: string;
  season: string | null;
  submittedAt: string | null;
  registrationNumber: string | null;
}

function bySubmission(a: BackfillRow, b: BackfillRow): number {
  const aKey = a.submittedAt || '￿';
  const bKey = b.submittedAt || '￿';
  if (aKey !== bKey) return aKey < bKey ? -1 : 1;
  return a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : 0;
}

/** Highest existing seq per start year, read from every row's registrationNumber, regardless of season. */
function maxSeqByStartYear(rows: BackfillRow[]): Map<number, number> {
  const max = new Map<number, number>();
  for (const row of rows) {
    const parsed = parseRegistrationNumber(row.registrationNumber);
    if (!parsed) continue;
    max.set(parsed.startYear, Math.max(max.get(parsed.startYear) ?? 0, parsed.seq));
  }
  return max;
}

function groupBySeason(rows: BackfillRow[]): {
  bySeason: Map<string, BackfillRow[]>;
  skipped: { documentId: string; reason: 'no-season' }[];
} {
  const skipped: { documentId: string; reason: 'no-season' }[] = [];
  const bySeason = new Map<string, BackfillRow[]>();
  for (const row of rows) {
    const label = normalizeSeasonLabel(row.season);
    if (!label) {
      skipped.push({ documentId: row.documentId, reason: 'no-season' });
      continue;
    }
    const list = bySeason.get(label) ?? [];
    list.push(row);
    bySeason.set(label, list);
  }
  return { bySeason, skipped };
}

export function planRegistrationBackfill(rows: BackfillRow[]): {
  assign: { documentId: string; registrationNumber: string }[];
  skipped: { documentId: string; reason: 'no-season' }[];
} {
  const { bySeason, skipped } = groupBySeason(rows);
  const maxSeqByYear = maxSeqByStartYear(rows);
  const assign: { documentId: string; registrationNumber: string }[] = [];
  for (const label of [...bySeason.keys()].sort()) {
    const year = seasonStartYear(label);
    let seq = maxSeqByYear.get(year) ?? 0;
    for (const row of [...bySeason.get(label)!].sort(bySubmission)) {
      if (row.registrationNumber) continue;
      seq += 1;
      assign.push({ documentId: row.documentId, registrationNumber: formatRegistrationNumber(year, seq) });
    }
  }
  return { assign, skipped };
}
