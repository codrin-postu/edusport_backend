import type { SkateResult } from './client';

/** A hand-entered Strapi competition, as the admin Competiții page saves it. */
export type HandEntry = { id: number; name: string; date: string | null; location: string | null; participantData: unknown };

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** One result per participant row of this profile. `result_id` is `id * 100 + i` (i among the profile's rows): numeric, stable, unique per athlete. */
export function handResults(entries: HandEntry[], profileId: string): SkateResult[] {
  return entries.flatMap((entry) => {
    if (!Array.isArray(entry.participantData)) return [];
    const own = entry.participantData.filter(
      (row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row) && (row as Record<string, unknown>).documentId === profileId,
    );
    return own.map((row, i): SkateResult => ({
      result_id: entry.id * 100 + i,
      placement: finite(row.placement),
      event_id: entry.id,
      event_slug: null,
      event_name: entry.name,
      event_date: entry.date,
      event_location: entry.location,
      category: typeof row.category === 'string' ? row.category : '',
      total_score: finite(row.score),
      short_score: null,
      free_score: null,
      segments: [],
    }));
  });
}
