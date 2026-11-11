/** Shapes of the athlete access admin routes (7-1 Task 8). No Strapi, Node or React imports: the frontend copies this file verbatim. */
export type AccessState = 'none' | 'invited' | 'active' | 'disabled';
export type AccessBlock = { athleteId: string; state: AccessState; email: string | null; since: string | null; adult: boolean; canInvite: boolean; hint: string | null };
export type BulkSkipReason = 'nou' | 'fără e-mail' | 'are deja acces' | 'anonimizat';
export type BulkPreview = { invites: number; addresses: number; skipped: { athleteId: string; name: string; reason: BulkSkipReason }[] };
