/** What the admin "Cont portal" block reads and what the account routes answer. Server-free. */
export type AccountState = 'none' | 'invited' | 'active' | 'disabled';
/** `since`: invitedAt for invited, activatedAt for active, disabledAt for disabled (YYYY-MM-DD, Bucharest); the UI formats it. */
export type AccountBlock = { teamMemberId: string; accountId: string | null; state: AccountState; email: string | null; since: string | null; google: boolean };
export type AccountAnswer = { account: AccountBlock; toast: string };
