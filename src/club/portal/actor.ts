import type { AccountRow } from './types';

/**
 * The history name of an account holder (index ruling 11): a coach side (team member, not switched off) is "Antrenor <nume>", anyone else
 * is the account name, else its e-mail.
 */
export function portalActor(account: AccountRow, teamMemberName: string | null): string {
  if (account.teamMemberId !== null && account.coachDisabledAt === null && teamMemberName) return `Antrenor ${teamMemberName}`;
  return account.name?.trim() || account.email;
}
