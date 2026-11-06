import { refuse, type AuthRefusal } from '../../admin-result';
import { PORTAL_ACTIONS, PORTAL_ERRORS, RESET_SENT } from '../copy';
import { normalizeEmail } from '../limits';
import { checkPassword } from '../passwords';
import type { AccountRow, TokenRow } from '../store';
import { RESET_MAX_TRIES, RESET_TTL_MS, hashSecret, newResetCode, sameHash, tokenState } from '../tokens';
import type { PortalAuthContext, PortalResult } from './context';
import { canEnter, issueSession, type PortalSession } from './issue';

const CODE_MAX = 64;
const DEVICE_KEY_MAX = 200;

const paused: AuthRefusal = { ok: false, status: 429, error: PORTAL_ERRORS.paused };
const badCode: PortalResult<never> = { ok: false, status: 400, error: PORTAL_ERRORS.badCode };
const sent: PortalResult<{ message: string }> = { ok: true, data: { message: RESET_SENT } };

/** Marks every unused reset token of the account as used. Runs inside a transaction that holds the account lock. */
async function useUpOpen(c: PortalAuthContext, accountId: string, except?: string): Promise<void> {
  const at = c.now().toISOString();
  for (const t of await c.store.tokens(accountId, 'reset')) {
    if (t.usedAt === null && t.id !== except) await c.store.updateToken(t.id, { usedAt: at });
  }
}

async function failSend(c: PortalAuthContext, accountId: string, tokenId: string): Promise<void> {
  await c.store.transaction(async () => {
    await c.store.lockAccount(accountId);
    await c.store.updateToken(tokenId, { usedAt: c.now().toISOString() });
  });
}

async function sendCode(c: PortalAuthContext, email: string, code: string): Promise<boolean> {
  try {
    return await c.mail(email, { kind: 'reset', code });
  } catch (err) {
    c.log(`[portal-reset] mail failed: ${err instanceof Error ? err.name : 'error'}`);
    return false;
  }
}

/** The same answer for every e-mail: an unknown or disabled account, or a spent send limit, only skips the token and the mail. */
export async function requestReset(c: PortalAuthContext, body: unknown): Promise<PortalResult<{ message: string }>> {
  const email = normalizeEmail(typeof body === 'object' && body !== null ? (body as Record<string, unknown>).email : null);
  if (email === null) return refuse(400, PORTAL_ERRORS.invalid);
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const account = await c.store.accountByEmail(email);
  const allowed = await c.limits.mailAllowed(email);
  if (!account || account.status === 'disabled' || !allowed) return sent;
  const code = newResetCode();
  const tokenId = await c.store.transaction(async () => {
    await c.store.lockAccount(account.id);
    await useUpOpen(c, account.id);
    return c.store.createToken({ accountId: account.id, kind: 'reset', secretHash: hashSecret(code), expiresAt: new Date(c.now().getTime() + RESET_TTL_MS).toISOString() });
  });
  if (!(await sendCode(c, email, code))) {
    await failSend(c, account.id, tokenId);
    return { ok: false, status: 503, error: PORTAL_ERRORS.sendFailed };
  }
  return sent;
}

type ConfirmBody = { host: string; email: string; code: string; password: string; deviceKey: string | null };

function readConfirmBody(body: unknown, hosts: string[]): ConfirmBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { host, email, code, password, deviceKey } = body as Record<string, unknown>;
  const normalized = normalizeEmail(email);
  const key = deviceKey === undefined || deviceKey === null ? null : typeof deviceKey === 'string' && deviceKey !== '' && deviceKey.length <= DEVICE_KEY_MAX ? deviceKey : undefined;
  if (typeof host !== 'string' || !hosts.includes(host) || normalized === null || key === undefined) return null;
  if (typeof code !== 'string' || code === '' || code.length > CODE_MAX || typeof password !== 'string') return null;
  return { host, email: normalized, code: code.trim(), password, deviceKey: key };
}

type Checked = { right: false } | { right: true; account: AccountRow };

/** One transaction under the account lock: a wrong code spends a try (committed), the right one sets the password. */
async function checkCode(c: PortalAuthContext, accountId: string, code: string, passwordHash: string): Promise<Checked> {
  return c.store.transaction(async () => {
    await c.store.lockAccount(accountId);
    const account = await c.store.account(accountId);
    const open = (await c.store.tokens(accountId, 'reset')).filter((t: TokenRow) => t.usedAt === null);
    const token = open[open.length - 1];
    if (!account || account.status === 'disabled' || !token || tokenState(token, c.now()) !== 'valid') return { right: false };
    if (!sameHash(hashSecret(code), token.secretHash)) {
      const tries = token.tries + 1;
      await c.store.updateToken(token.id, tries >= RESET_MAX_TRIES ? { tries, usedAt: c.now().toISOString() } : { tries });
      return { right: false };
    }
    const at = c.now().toISOString();
    await c.store.updateToken(token.id, { usedAt: at });
    await useUpOpen(c, accountId, token.id);
    await c.store.updateUser(account.userId, { passwordHash, confirmed: true });
    if (account.status === 'invited') await c.store.updateAccount(accountId, { status: 'active', activatedAt: at });
    await c.store.record({ subjectId: accountId, action: PORTAL_ACTIONS.passwordReset, changes: {}, actor: account.email });
    return { right: true, account: { ...account, status: account.status === 'invited' ? 'active' : account.status } };
  });
}

export async function confirmReset(c: PortalAuthContext, body: unknown): Promise<PortalResult<PortalSession>> {
  const read = readConfirmBody(body, c.hosts);
  if (!read) return refuse(400, PORTAL_ERRORS.invalid);
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const rule = checkPassword(read.password, read.email, c.common);
  if (rule !== null) return refuse(400, rule);
  const account = await c.store.accountByEmail(read.email);
  // Hashed also for an unknown e-mail, so the answer takes as long.
  const passwordHash = await c.hash(read.password);
  if (!account) return badCode;
  const checked = await checkCode(c, account.id, read.code, passwordHash);
  if (!checked.right) return badCode;
  await c.sessions.revokeAll(checked.account.userId);
  const user = await c.store.user(checked.account.userId);
  if (!canEnter(checked.account, user, read.host)) return { ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin };
  return { ok: true, data: await issueSession(c, checked.account, read.deviceKey, { notifyNewDevice: true }) };
}
