import type { TickTree } from '../calendar/group-ticks';
import { countWords } from '../ro-count';

/** Where an announcement shows and for whom; a null `showOnSite` (a row from before the field) reads as ticked. Pure. */
export type Places = { showOnSite?: boolean | null; showOnPortal?: boolean | null };

const onSite = (a: Places): boolean => a.showOnSite !== false;

export function audienceText(a: { showOnPortal: boolean | null; portalGroupIds: string[] | null }): string {
  if (!a.showOnPortal) return 'Toți';
  if (a.portalGroupIds === null) return 'Toate grupele';
  return countWords(a.portalGroupIds.length, 'grupă', 'grupe');
}

/** The site-only fields (format, button, small label, reappear days) apply unless the portal is the only place. */
export const siteFieldsShown = (a: Places): boolean => onSite(a) || !a.showOnPortal;

export const sortedUnique = (ids: Iterable<string>): string[] => [...new Set(ids)].sort();

const treeIds = (tree: TickTree): string[] => tree.sections.flatMap((s) => s.groups.map((g) => g.id));

/** The tick tree keeps the UNTICKED ids; the announcement keeps the chosen ones. */
export const exceptOfChosen = (tree: TickTree, chosen: string[]): string[] => treeIds(tree).filter((id) => !chosen.includes(id));
export const chosenOfExcept = (tree: TickTree, except: string[]): string[] => treeIds(tree).filter((id) => !except.includes(id));

type TreeGroup = { id: string; name: string; sectionId: string | null; order: number | null; active: boolean };
type TreeSection = { id: string; name: string; order: number | null };

const byOrder = <T extends { order: number | null; name: string }>(a: T, b: T): number =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'ro');

/** Sections with their active groups, names only; a section without active groups is left out. */
export function groupTree(groups: TreeGroup[], sections: TreeSection[]): TickTree {
  const active = groups.filter((g) => g.active).sort(byOrder);
  return {
    sections: [...sections].sort(byOrder).flatMap((s) => {
      const own = active.filter((g) => g.sectionId === s.id).map((g) => ({ id: g.id, name: g.name }));
      return own.length ? [{ id: s.id, name: s.name, groups: own }] : [];
    }),
  };
}
