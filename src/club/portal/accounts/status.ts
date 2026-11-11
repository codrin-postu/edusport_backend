import { refuse, type AdminResult } from '../../admin-result';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { PORTAL_ACTIONS, PORTAL_ERRORS } from '../copy';
import { ACCOUNT_TOASTS } from '../copy-admin';
import type { AccountRow } from '../store';
import type { AccountAnswer } from './api-types';
import { answer, guardedWrite, revokeAccess, useUpTokens } from './invite';
import { blockFor, type AccountContext } from './read';

const blockAnswer = async (c: AccountContext, account: AccountRow, toast: string): Promise<AdminResult<AccountAnswer>> =>
  answer(await blockFor(c, account.teamMemberId ?? '', account), toast);

/** Inside the account lock: the whole account goes (user blocked, every device and session, open tokens); the history line names the action. */
async function switchOffAll(c: AccountContext, account: AccountRow, action: string): Promise<void> {
  const at = c.now().toISOString();
  await c.store.updateAccount(account.id, { status: 'disabled', disabledAt: at, disabledBy: c.actor });
  await c.store.updateUser(account.userId, { blocked: true });
  for (const d of await c.store.devices(account.id)) if (d.revokedAt === null) await c.store.updateDevice(d.id, { revokedAt: at });
  await useUpTokens(c, account.id, ['invite', 'reset']);
  await c.sessions.revokeAll(account.userId);
  await c.store.record({ subjectId: account.id, action, changes: {}, actor: c.actor });
}

/** Inside the account lock: only the antrenor side goes; the holder side, the user and the sportiv sessions stay (spec 4.3). */
async function switchOffCoach(c: AccountContext, account: AccountRow): Promise<void> {
  await c.store.updateAccount(account.id, { coachDisabledAt: c.now().toISOString() });
  await revokeAccess(c, account, 'antrenor');
  await c.store.record({ subjectId: account.id, action: PORTAL_ACTIONS.coachSideOff, changes: {}, actor: c.actor });
}

async function disableWith(c: AccountContext, accountId: string, tag: string, whole: boolean): Promise<AdminResult<AccountAnswer>> {
  return guardedWrite(c, tag, async () => {
    if (!(await c.store.account(accountId))) return refuse(404, PORTAL_ERRORS.notFound);
    const done = await c.store.transaction(async () => {
      await c.store.lockAccount(accountId);
      const account = await c.store.account(accountId);
      if (!account) return null;
      if (account.status === 'disabled') return account;
      const coachOnly = !whole && account.teamMemberId !== null && (await c.access.liveByAccount(accountId)).length > 0;
      if (coachOnly && account.coachDisabledAt !== null) return account;
      if (coachOnly) await switchOffCoach(c, account);
      else await switchOffAll(c, account, whole ? PORTAL_ACTIONS.accountOff : PORTAL_ACTIONS.disabled);
      return (await c.store.account(accountId)) as AccountRow;
    });
    return done ? blockAnswer(c, done, ACCOUNT_TOASTS.disabled) : refuse(404, PORTAL_ERRORS.notFound);
  });
}

/**
 * Disables an invited or active account (4.3): one transaction, account lock first. An account that also holds athletes loses only its
 * coach side (its sportiv side keeps working); any other account goes whole. Sessions are revoked inside the transaction (the nested
 * transaction is reused), so a failure rolls the disable back instead of leaving sessions a later enable could revive.
 */
export async function disableAccount(c: AccountContext, accountId: string): Promise<AdminResult<AccountAnswer>> {
  return disableWith(c, accountId, 'portal account disable', false);
}

/** "Dezactivează tot": the whole account goes, holder side included. */
export async function disableAll(c: AccountContext, accountId: string): Promise<AdminResult<AccountAnswer>> {
  return disableWith(c, accountId, 'portal account disable all', true);
}

/** `disabled` -> `active` when the coach had activated the account, else back to `invited` (the admin resends the invite). */
export async function enableAccount(c: AccountContext, accountId: string): Promise<AdminResult<AccountAnswer>> {
  return guardedWrite(c, 'portal account enable', async () => {
    if (!(await c.store.account(accountId))) return refuse(404, PORTAL_ERRORS.notFound);
    const done = await c.store.transaction(async () => {
      await c.store.lockAccount(accountId);
      const account = await c.store.account(accountId);
      if (!account || (account.status !== 'disabled' && account.coachDisabledAt === null)) return null;
      const back = account.status === 'disabled' ? { status: account.activatedAt ? ('active' as const) : ('invited' as const), disabledAt: null, disabledBy: null } : {};
      await c.store.updateAccount(accountId, { ...back, coachDisabledAt: null });
      if (account.status === 'disabled') await c.store.updateUser(account.userId, { blocked: false });
      await c.store.record({ subjectId: accountId, action: PORTAL_ACTIONS.enabled, changes: {}, actor: c.actor });
      return (await c.store.account(accountId)) as AccountRow;
    });
    return done ? blockAnswer(c, done, ACCOUNT_TOASTS.enabled) : refuse(409, ADMIN_ERRORS.stale);
  });
}
