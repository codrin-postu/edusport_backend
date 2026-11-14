import { PAUZE_COPY } from '../groups/copy';
import { countWords } from '../ro-count';

/** What a break would cancel, per group (spec S4). Pure. */
export type ImpactGroup = { id: string; name: string; sessions: number };
export type ImpactSection = { id: string; name: string; kind: 'school' | 'club'; groups: ImpactGroup[] };
export type BreakImpact = { sections: ImpactSection[] };

const allGroups = (i: BreakImpact): ImpactGroup[] => i.sections.flatMap((s) => s.groups);

function totals(i: BreakImpact, except: string[]): { sessions: number; groups: number; of: number } {
  const all = allGroups(i);
  const ticked = all.filter((g) => !except.includes(g.id));
  return { sessions: ticked.reduce((n, g) => n + g.sessions, 0), groups: ticked.length, of: all.length };
}

export function impactTitle(i: BreakImpact, except: string[]): string {
  const t = totals(i, except);
  return PAUZE_COPY.impactTitle(t.sessions, t.groups, t.of);
}

export function groupLine(g: ImpactGroup, ticked: boolean): string {
  if (!ticked) return PAUZE_COPY.stays;
  return g.sessions ? countWords(g.sessions, 'ședință', 'ședințe') : PAUZE_COPY.none;
}

/** The "Se anulează" cell of the Pauze list. */
export function breakListLine(i: BreakImpact, except: string[]): string {
  const t = totals(i, except);
  return `${countWords(t.sessions, 'ședință', 'ședințe')}, ${t.groups === t.of ? PAUZE_COPY.allGroups : PAUZE_COPY.someGroups(t.groups, t.of)}`;
}
