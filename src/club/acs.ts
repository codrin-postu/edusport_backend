export type AcsState = 'da' | 'nu' | 'in_asteptare';

/** New season: last season's members start "în așteptare"; everyone else has no value. */
export function carryOverAcs(
  previous: { athleteId: string; state: AcsState }[],
): { athleteId: string; state: AcsState }[] {
  return previous
    .filter((p) => p.state === 'da')
    .map((p) => ({ athleteId: p.athleteId, state: 'in_asteptare' as AcsState }));
}

export function effectiveAcs(state: AcsState | null | undefined): AcsState {
  return state ?? 'nu';
}

export function usesMemberPrice(state: AcsState | null | undefined): boolean {
  return state === 'da';
}
