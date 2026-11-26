import type { AdminArea } from '../admin-area';

export type WelcomeRole = 'superAdmin' | 'club' | 'editor';

/** The welcome line of an admin: superAdmin area, else club area, else editor. */
export function welcomeRole(has: (a: AdminArea) => boolean): WelcomeRole {
  if (has('superAdmin')) return 'superAdmin';
  return has('club') ? 'club' : 'editor';
}

/** Tour anchor of a sidebar row (the Cursuri row opens the "Modifică o pagină" flow); undefined for every other row. */
export const rowAnchor = (to: string): string | undefined => (to === '/plugins/edusport-cursuri' ? 'row-cursuri' : undefined);

/** CSS selector of a step anchor. */
export const anchorSelector = (anchor: string): string => `[data-tour="${anchor}"]`;
