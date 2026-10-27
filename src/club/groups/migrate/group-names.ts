import { normalizeGroupName } from '../../migrate/names';

/** Step 1 (spec 4): any group name with cedilla letters is rewritten with comma letters; every rename printed. Pure. */
export type Rename = { id: string; from: string; to: string };

export const planGroupNames = (groups: { id: string; name: string }[]): Rename[] =>
  groups.map((g) => ({ id: g.id, from: g.name, to: normalizeGroupName(g.name) })).filter((r) => r.from !== r.to);
