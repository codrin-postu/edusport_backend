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

export interface BackfillRow {
  documentId: string;
  season: string | null;
  submittedAt: string | null;
  registrationNumber: string | null;
}

function bySubmission(a: BackfillRow, b: BackfillRow): number {
  if (a.submittedAt && b.submittedAt && a.submittedAt !== b.submittedAt) {
    return a.submittedAt < b.submittedAt ? -1 : 1;
  }
  if (a.submittedAt && !b.submittedAt) return -1;
  if (!a.submittedAt && b.submittedAt) return 1;
  return a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : 0;
}

export function planRegistrationBackfill(rows: BackfillRow[]): {
  assign: { documentId: string; registrationNumber: string }[];
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
  const assign: { documentId: string; registrationNumber: string }[] = [];
  for (const label of [...bySeason.keys()].sort()) {
    const list = bySeason.get(label)!;
    const year = seasonStartYear(label);
    let seq = list.reduce((max, r) => {
      const parsed = parseRegistrationNumber(r.registrationNumber);
      return parsed && parsed.startYear === year ? Math.max(max, parsed.seq) : max;
    }, 0);
    for (const row of [...list].sort(bySubmission)) {
      if (row.registrationNumber) continue;
      seq += 1;
      assign.push({ documentId: row.documentId, registrationNumber: formatRegistrationNumber(year, seq) });
    }
  }
  return { assign, skipped };
}
