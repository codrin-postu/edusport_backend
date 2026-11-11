import type { AdminResult } from '../../admin-result';
import type { PortalAuthContext, PortalResult } from './context';
import { mayEnter, type PortalSession } from './issue';

const refused: PortalResult<never> = { ok: false, status: 401, error: '' };

const tokenOf = (body: unknown): string | null => {
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).refreshToken : null;
  return typeof raw === 'string' && raw !== '' ? raw : null;
};

/** A refresh is not a login attempt: the IP limiter is not touched. */
export async function refreshSession(c: PortalAuthContext, body: unknown): Promise<PortalResult<PortalSession>> {
  const token = tokenOf(body);
  const next = token ? await c.sessions.refresh(token) : null;
  if (!next) return refused;
  const account = await c.store.accountByUser(next.userId);
  const user = account ? await c.store.user(account.userId) : null;
  const device = account ? (await c.store.devices(account.id)).find((d) => d.id === next.deviceId) : undefined;
  if (!(await mayEnter(c, account, user, next.host)) || !device || device.revokedAt !== null) {
    await c.sessions.revoke(next.refreshToken);
    return refused;
  }
  const seen = c.now().toISOString();
  await c.store.updateDevice(device.id, device.sessionId === null ? { sessionId: next.sessionId, lastSeenAt: seen } : { lastSeenAt: seen });
  return { ok: true, data: { accessToken: next.accessToken, refreshToken: next.refreshToken, accessExpiresAt: next.accessExpiresAt, deviceKey: null } };
}

/** Always `{ ok: true }`, also for an unknown token. */
export async function logout(c: PortalAuthContext, body: unknown): Promise<AdminResult<{ ok: true }>> {
  const token = tokenOf(body);
  if (token) await c.sessions.revoke(token);
  return { ok: true, data: { ok: true } };
}
