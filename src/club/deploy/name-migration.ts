import { collapseSpaces } from '../person-match';

/** Deploy step 7 (spec 1.1): first + last become the one name. Profiles are not touched (N7, option A). */
export type LegacyName = { id: string; name: string | null; firstName: string | null; lastName: string | null; profileName: string | null };
export type NamePlan = { updates: { id: string; name: string }[]; empty: string[]; profileMismatches: { id: string; name: string; profileName: string }[] };

export function planNameMigration(rows: LegacyName[]): NamePlan {
  const plan: NamePlan = { updates: [], empty: [], profileMismatches: [] };
  for (const row of rows) {
    if (collapseSpaces(row.name)) continue;
    const name = collapseSpaces(`${row.firstName ?? ''} ${row.lastName ?? ''}`);
    if (!name) {
      plan.empty.push(row.id);
      continue;
    }
    plan.updates.push({ id: row.id, name });
    const profileName = collapseSpaces(row.profileName);
    if (profileName && profileName !== name) plan.profileMismatches.push({ id: row.id, name, profileName });
  }
  return plan;
}
