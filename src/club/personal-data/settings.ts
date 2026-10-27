/** "Ani până la anonimizare" and the yearly review notice (spec 2, 5). Pure: the admin bundle imports it too. */
export const DEFAULT_RETENTION_YEARS = 5;
export const RETENTION_BOUNDS = { min: 1, max: 20 } as const;

/** site-settings.personalData, as stored (a `type`, so it can be written to the json attribute). */
export type PersonalDataSettings = { retentionYears: number; reviewHiddenUntilSeason: string | null };

/** GET /api/club/athletes/inactive-summary: what the dashboard notice needs. */
export type InactiveSummary = { retentionYears: number; count: number; seasonLabel: string | null; shown: boolean };

const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** A whole number is kept between 1 and 20; anything else is the default (decided while planning, item 8). */
export function retentionYearsOf(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) return DEFAULT_RETENTION_YEARS;
  return Math.min(RETENTION_BOUNDS.max, Math.max(RETENTION_BOUNDS.min, v));
}

export function readPersonalDataSettings(raw: unknown): PersonalDataSettings {
  const r = record(raw);
  const hidden = typeof r.reviewHiddenUntilSeason === 'string' && r.reviewHiddenUntilSeason ? r.reviewHiddenUntilSeason : null;
  return { retentionYears: retentionYearsOf(r.retentionYears), reviewHiddenUntilSeason: hidden };
}

/** "Ascunde până la sezonul următor": the notice stays hidden while `seasonLabel` is the current season. */
export const hiddenUntil = (s: PersonalDataSettings, seasonLabel: string): PersonalDataSettings => ({ ...s, reviewHiddenUntilSeason: seasonLabel });

export const reviewNoticeShown = (s: PersonalDataSettings, count: number, seasonLabel: string | null): boolean =>
  count > 0 && (seasonLabel === null || s.reviewHiddenUntilSeason !== seasonLabel);
