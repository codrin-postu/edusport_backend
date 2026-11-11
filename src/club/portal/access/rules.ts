import { ageFromIso, partsFromIso } from '../../birth-date';
import type { AccountRow, UserAuth } from '../types';
import type { AccessState } from './api-types';
import { ACCESS_ERRORS } from './copy';
import type { AccessRow } from './types';

export type Host = 'antrenor' | 'sportiv';

/** The coach side of an account: a team member and the side not switched off. */
export const isCoachSide = (account: AccountRow): boolean => account.teamMemberId !== null && account.coachDisabledAt === null;

/** Per-host entry (spec 5.1). `liveAccess` counts the live accesses to athletes that are not anonymized; any other host is refused. */
export function canEnterHost(account: AccountRow | null, user: UserAuth | null, host: string, liveAccess: number): boolean {
  if (!account || !user || account.status !== 'active' || user.blocked) return false;
  if (host === 'antrenor') return isCoachSide(account);
  if (host === 'sportiv') return liveAccess >= 1;
  return false;
}

export type InvitePlan = { kind: 'create' } | { kind: 'add' } | { kind: 'reinvite'; host: Host } | { kind: 'refuse'; message: string };

/** The four invite outcomes of spec 4.2; `latestInviteHost` is the host of the account's newest invite token. */
export function planInvite(account: AccountRow | null, latestInviteHost: Host | null): InvitePlan {
  if (!account) return { kind: 'create' };
  if (account.status === 'active') return { kind: 'add' };
  if (account.status === 'invited') return { kind: 'reinvite', host: latestInviteHost ?? 'sportiv' };
  return { kind: 'refuse', message: ACCESS_ERRORS.disabled };
}

/** Why an athlete cannot be invited (spec 4.1), or null. */
export function inviteRefusal(athlete: { status: string; email: string | null }): string | null {
  if (athlete.status === 'anonimizat') return ACCESS_ERRORS.anonymized;
  if (athlete.status === 'nou') return ACCESS_ERRORS.needsConfirm;
  if (!athlete.email || !athlete.email.trim()) return ACCESS_ERRORS.needsEmail;
  return null;
}

/** Status is derived from the account (spec 3.1); no live access means none. */
export function accessState(account: AccountRow | null, live: AccessRow | null): AccessState {
  if (!live || !account) return 'none';
  return account.status;
}

export function isAdult(birthDate: string | null, today: string): boolean {
  const now = partsFromIso(today);
  const age = birthDate && now ? ageFromIso(birthDate, now) : null;
  return age !== null && age >= 18;
}

/** The holder's display name: the contact person when filled, else the athlete (spec 3.2). */
export function holderName(athlete: { contactName: string | null; name: string }): string {
  const contact = athlete.contactName?.trim();
  return contact ? contact : athlete.name;
}
