export type RevokeReason = 'scos' | 'email_schimbat' | 'anonimizat' | 'sters' | 'unit';
export type AccessRow = {
  id: string; athleteId: string; accountId: string; email: string; invitedAt: string; invitedBy: string;
  revokedAt: string | null; revokedBy: string | null; revokeReason: RevokeReason | null; levelSeenGroup: string | null; levelSeenAt: string | null;
};
export type NewAccess = Pick<AccessRow, 'athleteId' | 'accountId' | 'email' | 'invitedAt' | 'invitedBy'>;
export type AthleteForAccess = { id: string; name: string; email: string | null; status: string; birthDate: string | null; contactName: string | null };
