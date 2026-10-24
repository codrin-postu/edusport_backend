import { planRegistrationBackfill, type BackfillRow } from '../registration-number';
import { normalizeSeasonLabel } from '../season';

export type RegistrationRowForMigration = BackfillRow & { seasonRef: string | null; section: string | null };
export type SeasonTextRewrite = { from: string; to: string; count: number };
export type SeasonTextPlan = {
  updates: { documentId: string; from: string; to: string }[];
  rewrites: SeasonTextRewrite[];
  unrecognised: string[];
};
export type NumberingData = { registrationNumber: string; seasonRef?: string; section?: string };
export type NumberingPlan = {
  number: { documentId: string; data: NumberingData }[];
  link: { documentId: string; seasonRef: string }[];
  skipped: string[];
};

/** Old season texts (en dash, spaces) become the "YYYY-YYYY" label; a text that is no season is reported, never written. */
export function planSeasonTextNormalization(rows: { documentId: string; season: string | null }[]): SeasonTextPlan {
  const updates: SeasonTextPlan['updates'] = [];
  const counts = new Map<string, SeasonTextRewrite>();
  const unrecognised = new Set<string>();
  for (const { documentId, season } of rows) {
    const label = normalizeSeasonLabel(season);
    if (!season || label === season) continue;
    if (!label) {
      unrecognised.add(season);
      continue;
    }
    updates.push({ documentId, from: season, to: label });
    const rewrite = counts.get(season) ?? { from: season, to: label, count: 0 };
    counts.set(season, { ...rewrite, count: rewrite.count + 1 });
  }
  return { updates, rewrites: [...counts.values()], unrecognised: [...unrecognised] };
}

function numberingData(row: RegistrationRowForMigration, registrationNumber: string, seasonIdByLabel: Record<string, string>, schoolId: string | null): NumberingData {
  const data: NumberingData = { registrationNumber };
  const seasonRef = row.seasonRef ? null : seasonIdByLabel[normalizeSeasonLabel(row.season) ?? ''];
  if (seasonRef) data.seasonRef = seasonRef;
  if (schoolId && !row.section) data.section = schoolId;
  return data;
}

/**
 * Registrations sent after the phase 1 migration: numbered by phase 1's backfill (planRegistrationBackfill), linked to
 * the Sezon of their season and to the school when unset. A numbered row with no Sezon link gets the link only.
 */
export function planRegistrationNumbering(rows: RegistrationRowForMigration[], seasonIdByLabel: Record<string, string>, schoolId: string | null): NumberingPlan {
  const backfill = planRegistrationBackfill(rows);
  const byId = new Map(rows.map((r) => [r.documentId, r]));
  const number = backfill.assign.map(({ documentId, registrationNumber }) => ({
    documentId,
    data: numberingData(byId.get(documentId)!, registrationNumber, seasonIdByLabel, schoolId),
  }));
  const link = rows
    .filter((r) => r.registrationNumber && !r.seasonRef)
    .map((r) => ({ documentId: r.documentId, seasonRef: seasonIdByLabel[normalizeSeasonLabel(r.season) ?? ''] }))
    .filter((l): l is { documentId: string; seasonRef: string } => Boolean(l.seasonRef));
  return { number, link, skipped: backfill.skipped.map((s) => s.documentId) };
}
