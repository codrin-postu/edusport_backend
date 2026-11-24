import type { AdminArea } from '../admin-area';
import type { FeatureKey } from './features';

/** The part of a menu link the switches and areas look at. */
export type GatedLink = {
  area: AdminArea;
  /** Shown only while this switch is on. */
  feature?: FeatureKey;
  /** Shown only while this returns true (a link that needs more than one switch). */
  show?: (on: (k: FeatureKey) => boolean) => boolean;
};

/** Tabele shows when attendance or subscriptions is on (it holds both kinds of tables). */
export const tablesVisible = (on: (k: FeatureKey) => boolean): boolean => on('prezenta') || on('abonamente');

/** The links a caller's areas and the club's switches allow; the sidebar and the phone menu draw only these. */
export function visibleLinks<L extends GatedLink>(links: L[], has: (a: AdminArea) => boolean, on: (k: FeatureKey) => boolean): L[] {
  return links.filter((l) => has(l.area) && (!l.feature || on(l.feature)) && (!l.show || l.show(on)));
}

/** A page opened by URL: both the area and the switch must allow it. */
export function gateDecision(areaOk: boolean, featureOk: boolean): 'show' | 'noAccess' {
  return areaOk && featureOk ? 'show' : 'noAccess';
}
