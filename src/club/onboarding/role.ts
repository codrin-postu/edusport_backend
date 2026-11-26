import type { AdminArea } from '../admin-area';

export type WelcomeRole = 'superAdmin' | 'club' | 'editor';

/** The welcome line of an admin: superAdmin area, else club area, else editor. */
export function welcomeRole(has: (a: AdminArea) => boolean): WelcomeRole {
  if (has('superAdmin')) return 'superAdmin';
  return has('club') ? 'club' : 'editor';
}

/** CSS selector of a step anchor. */
export const anchorSelector = (anchor: string): string => `[data-tour="${anchor}"]`;
