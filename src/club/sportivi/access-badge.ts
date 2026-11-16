import type { AccessState } from '../portal/access/api-types';

export type AccessBadgeState = 'none' | 'invited' | 'active';
export type AccessBadgeView = { text: 'FĂRĂ ACCES' | 'INVITAT' | 'ACTIV'; tone: 'neutral' | 'warning' | 'success' };

const BADGES: Record<AccessBadgeState, AccessBadgeView> = {
  none: { text: 'FĂRĂ ACCES', tone: 'neutral' },
  invited: { text: 'INVITAT', tone: 'warning' },
  active: { text: 'ACTIV', tone: 'success' },
};

/** The status label of "Acces portal": three words, flat square badge. */
export const accessBadge = (state: AccessBadgeState): AccessBadgeView => BADGES[state];

/** A disabled account has no way into the portal, so it reads like no access. */
export const accessBadgeState = (state: AccessState): AccessBadgeState => (state === 'disabled' ? 'none' : state);
