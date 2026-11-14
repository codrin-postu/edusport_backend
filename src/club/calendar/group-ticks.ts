/** Pure state of the group tick tree (Pauze dialog; spec S4). The state is the list of UNTICKED group ids ("except"). */
export type TickTree = { sections: { id: string; name: string; groups: { id: string; name: string; sessions?: number }[] }[] };
type TickSection = TickTree['sections'][number];

export function sectionState(s: TickSection, except: string[]): 'all' | 'none' | 'some' {
  const off = s.groups.filter((g) => except.includes(g.id)).length;
  return off === 0 ? 'all' : off === s.groups.length ? 'none' : 'some';
}

const sorted = (ids: Iterable<string>): string[] => [...new Set(ids)].sort();

/** 'all' unticks every group of the section; 'some' and 'none' tick them all. */
export function toggleSection(s: TickSection, except: string[]): string[] {
  const own = new Set(s.groups.map((g) => g.id));
  const rest = except.filter((id) => !own.has(id));
  return sorted(sectionState(s, except) === 'all' ? [...rest, ...own] : rest);
}

export const toggleGroup = (id: string, except: string[]): string[] =>
  sorted(except.includes(id) ? except.filter((e) => e !== id) : [...except, id]);

export const tickedSessions = (s: TickSection, except: string[]): number =>
  s.groups.filter((g) => !except.includes(g.id)).reduce((n, g) => n + (g.sessions ?? 0), 0);
