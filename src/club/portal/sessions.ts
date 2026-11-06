import { ownSessions } from './sessions-own';
import type { PortalStore } from './store';

export type IssuedTokens = { accessToken: string; refreshToken: string; accessExpiresAt: string; sessionId: string };
export type AccessCheck = { userId: number; sessionId: string } | null;

export interface PortalSessions {
  issue(userId: number, deviceId: string): Promise<IssuedTokens>;
  /** null: unknown, reused, idle > 7 d, family > 30 d. */
  refresh(refreshToken: string): Promise<(IssuedTokens & { userId: number; deviceId: string }) | null>;
  /** Hash known, not expired, session not revoked. */
  verifyAccess(accessToken: string): Promise<AccessCheck>;
  /** Logout; an unknown token is a no-op. */
  revoke(refreshToken: string): Promise<void>;
  revokeDevice(userId: number, deviceId: string): Promise<void>;
  revokeAll(userId: number, exceptSessionId?: string): Promise<void>;
}

/** One instance per request: it shares the store (and its transaction variable) with the caller. */
export const portalSessions = (store: PortalStore, now: () => Date = () => new Date()): PortalSessions => ownSessions(store, now);
