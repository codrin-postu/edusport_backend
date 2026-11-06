import { refuse, type AuthRefusal } from '../../admin-result';
import { PORTAL_ACTIONS, PORTAL_ERRORS } from '../copy';
import { checkPassword } from '../passwords';
import type { AccountRow, TokenRow } from '../store';
import { hashSecret, tokenState } from '../tokens';
import type { PortalAuthContext, PortalResult } from './context';
import { canEnter, startSession, type PortalSession } from './issue';

export type InviteRead = { state: 'valid'; email: string } | { state: 'expired'; email: null };

const SECRET_MAX = 200;
const DEVICE_KEY_MAX = 200;
const DEFAULT_HOST = 'antrenor';

const paused: AuthRefusal = { ok: false, status: 429, error: PORTAL_ERRORS.paused };
const expiredInvite: AuthRefusal = { ok: false, status: 410, error: PORTAL_ERRORS.inviteExpired };

type Live = { token: TokenRow; account: AccountRow };

/** The token for the secret when it is an unused, unexpired invite of an `invited` account. */
export async function liveInvite(c: PortalAuthContext, secret: string): Promise<Live | null> {
  if (secret === '' || secret.length > SECRET_MAX) return null;
  const token = await c.store.tokenByHash(hashSecret(secret));
  if (!token || token.kind !== 'invite' || tokenState(token, c.now()) !== 'valid') return null;
  const account = await c.store.account(token.accountId);
  return account && account.status === 'invited' ? { token, account } : null;
}

export async function readInvite(c: PortalAuthContext, secret: string): Promise<PortalResult<InviteRead>> {
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const live = await liveInvite(c, secret);
  return { ok: true, data: live ? { state: 'valid', email: live.account.email } : { state: 'expired', email: null } };
}

/** Inside a transaction that holds the account lock: token used, account active, user confirmed, history line. */
export async function activateInvited(c: PortalAuthContext, account: AccountRow, how: 'password' | 'google', token: TokenRow): Promise<void> {
  const at = c.now().toISOString();
  const name = account.teamMemberId ? await c.store.teamMemberName(account.teamMemberId) : null;
  await c.store.updateToken(token.id, { usedAt: at });
  await c.cancelInvites?.(account.id);
  await c.store.updateAccount(account.id, { status: 'active', activatedAt: at });
  await c.store.updateUser(account.userId, { confirmed: true });
  await c.store.record({
    subjectId: account.id,
    action: how === 'google' ? PORTAL_ACTIONS.activatedGoogle : PORTAL_ACTIONS.activated,
    changes: {},
    actor: name ? `Antrenor ${name}` : 'Antrenor',
  });
}

type AcceptBody = { secret: string; password: string; host: string; deviceKey: string | null };

function readAcceptBody(body: unknown, hosts: string[]): AcceptBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { secret, password, host, deviceKey } = body as Record<string, unknown>;
  const key = deviceKey === undefined || deviceKey === null ? null : typeof deviceKey === 'string' && deviceKey !== '' && deviceKey.length <= DEVICE_KEY_MAX ? deviceKey : undefined;
  const chosen = host === undefined ? DEFAULT_HOST : host;
  if (typeof secret !== 'string' || secret === '' || secret.length > SECRET_MAX || typeof password !== 'string' || key === undefined) return null;
  if (typeof chosen !== 'string' || !hosts.includes(chosen)) return null;
  return { secret, password, host: chosen, deviceKey: key };
}

export async function acceptInvite(c: PortalAuthContext, body: unknown): Promise<PortalResult<PortalSession>> {
  const read = readAcceptBody(body, c.hosts);
  if (!read) return refuse(400, PORTAL_ERRORS.invalid);
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const before = await liveInvite(c, read.secret);
  const rule = checkPassword(read.password, before?.account.email ?? '', c.common);
  if (rule !== null) return refuse(400, rule);
  if (!before) return expiredInvite;
  const passwordHash = await c.hash(read.password);
  const activated = await c.store.transaction(async (): Promise<AccountRow | null> => {
    await c.store.lockAccount(before.account.id);
    const now = await liveInvite(c, read.secret);
    if (!now) return null;
    await c.store.updateUser(now.account.userId, { passwordHash });
    await activateInvited(c, now.account, 'password', now.token);
    return { ...now.account, status: 'active' };
  });
  if (!activated) return expiredInvite;
  const user = await c.store.user(activated.userId);
  if (!canEnter(activated, user, read.host)) return { ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin };
  return startSession(c, activated, read.deviceKey, { notifyNewDevice: false, host: read.host });
}
