import type { AthleteStatus } from '../athlete-data';
import { duplicateLevel, type PersonFacts, type StoredMatchLevel } from '../matching';
import { isAnonymized } from '../personal-data/anonymize-plan';

/**
 * Deploy step 11 (spec 2.3, d12): pairs flagged once, for the "Posibil același copil cu <nume>" line.
 * `existing`: every pair already in athlete-duplicate, in any state, dismissed ("Nu e același copil") included,
 * so a dismissed pair is never flagged again (spec 1.1). An anonymized athlete is never flagged (3C, review I2).
 */
export type FlagCandidate = PersonFacts & { id: string; status: AthleteStatus };
export type FlagPair = { firstId: string; secondId: string; level: StoredMatchLevel };

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function flagPair(a: FlagCandidate, b: FlagCandidate, known: ReadonlySet<string>): FlagPair | null {
  if (known.has(pairKey(a.id, b.id))) return null;
  const level = duplicateLevel(a, b);
  return level ? { firstId: a.id, secondId: b.id, level } : null;
}

export function planDuplicateFlags(athletes: FlagCandidate[], existing: { firstId: string; secondId: string }[]): FlagPair[] {
  const known = new Set(existing.map((p) => pairKey(p.firstId, p.secondId)));
  const live = athletes.filter((a) => !isAnonymized(a));
  const create: FlagPair[] = [];
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const pair = flagPair(live[i], live[j], known);
      if (pair) create.push(pair);
    }
  }
  return create;
}
