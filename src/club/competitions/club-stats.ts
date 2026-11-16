/** Club statistics of one competition: podiums (placement 1 to 3) and the best placement over the club athletes' results. */
export type ClubStats = { podiums: number; bestPlacement: number | null };

export function clubStats(results: { athleteIsClub: boolean; placement: number | null }[]): ClubStats {
  let podiums = 0;
  let bestPlacement: number | null = null;
  for (const r of results) {
    if (!r.athleteIsClub || r.placement === null) continue;
    if (r.placement >= 1 && r.placement <= 3) podiums += 1;
    if (bestPlacement === null || r.placement < bestPlacement) bestPlacement = r.placement;
  }
  return { podiums, bestPlacement };
}

/** The stats per event id, from the club athletes' results (all of them club). An event without a club result is not in the map. */
export function clubStatsByEvent(rows: { eventId: number; placement: number | null }[]): Map<number, ClubStats> {
  const grouped = new Map<number, { athleteIsClub: true; placement: number | null }[]>();
  for (const r of rows) grouped.set(r.eventId, [...(grouped.get(r.eventId) ?? []), { athleteIsClub: true, placement: r.placement }]);
  return new Map([...grouped].map(([id, results]) => [id, clubStats(results)]));
}
