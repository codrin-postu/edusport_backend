/** The Competiții tab of the athlete record: pure rules and copy, free of server imports (the admin bundle uses it). The read is in competitions-read.ts. */

/** One result. `resultId` is the portal's result id, so a score sheet can be opened from a line later. */
export type CompetitionLine = { date: string | null; name: string; category: string | null; placement: number | null; score: number | null; resultId?: string };
export type CompetitionsSummary = { competitions: number; podiums: number; bestPlacement: number | null; bestScore: number | null };
export type AthleteCompetitions = { available: boolean; seasons: string[]; season: string | null; summary: CompetitionsSummary; lines: CompetitionLine[] };

/** COPY NEEDED: the unavailable text and the tab and tile labels beyond the brief's own words. */
export const COMPETITII_COPY = {
  tab: 'Competiții',
  tiles: { competitions: 'Competiții', podiums: 'Podiumuri', bestPlacement: 'Cel mai bun loc', bestScore: 'Cel mai bun scor' },
  columns: { date: 'Data', name: 'Competiție', category: 'Categorie', placement: 'Loc', score: 'Scor' },
  season: 'Sezon',
  allSeasons: 'Toate sezoanele',
  empty: 'Nicio competiție.',
  unavailable: 'Rezultatele nu sunt disponibile acum.',
  failed: 'Nu am putut încărca competițiile.',
} as const;

const extreme = (values: (number | null)[], pick: (a: number, b: number) => number): number | null => {
  const found = values.filter((v): v is number => v !== null);
  return found.length > 0 ? found.reduce((a, b) => pick(a, b)) : null;
};

/** A podium is a placement from 1 to 3. */
export function summarize(lines: CompetitionLine[]): CompetitionsSummary {
  return {
    competitions: lines.length,
    podiums: lines.filter((l) => l.placement !== null && l.placement >= 1 && l.placement <= 3).length,
    bestPlacement: extreme(lines.map((l) => l.placement), Math.min),
    bestScore: extreme(lines.map((l) => l.score), Math.max),
  };
}

/** By date, newest first; a line without a date goes last. */
export function newestFirst(lines: CompetitionLine[]): CompetitionLine[] {
  return [...lines].sort((a, b) => (a.date === b.date ? 0 : a.date === null ? 1 : b.date === null ? -1 : b.date.localeCompare(a.date)));
}

export function bySeason(lines: (CompetitionLine & { season: string })[], season: string | null): CompetitionLine[] {
  return (season === null ? lines : lines.filter((l) => l.season === season)).map(({ season: _season, ...line }) => line);
}

/** "43,20": two decimals and a Romanian decimal comma; a missing score is a hyphen. */
export const scoreText = (v: number | null): string => (v === null ? '-' : v.toFixed(2).replace('.', ','));
