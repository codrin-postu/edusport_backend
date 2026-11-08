import { refuse, type AdminResult } from '../../admin-result';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { PORTAL_ACTIONS, PORTAL_ERRORS } from '../copy';
import { ACCOUNT_TOASTS } from '../copy-admin';
import type { AccountRow } from '../store';
import type { AccountAnswer } from './api-types';
import { answer, guardedWrite, useUpTokens } from './invite';
import { blockFor, type AccountContext } from './read';

const blockAnswer = async (c: AccountContext, account: AccountRow, toast: string): Promise<AdminResult<AccountAnswer>> =>
  answer(await blockFor(c, account.teamMemberId ?? '', account), toast);

/**
 * Disables an invited or active account (4.3): one transaction, account lock first. The sessions are revoked inside it
 * (the nested transaction is reused), so a failure rolls the disable back instead of leaving sessions a later enable could revive.
 */
export async function disableAccount(c: AccountContext, accountId: string): Promise<AdminResult<AccountAnswer>> {
  return guardedWrite(c, 'portal account disable', async () => {
    if (!(await c.store.account(accountId))) return refuse(404, PORTAL_ERRORS.notFound);
    const done = await c.store.transaction(async () => {
      await c.store.lockAccount(accountId);
      const account = await c.store.account(accountId);
      if (!account) return null;
      if (account.status === 'disabled') return account;
      const at = c.now().toISOString();
      await c.store.updateAccount(accountId, { status: 'disabled', disabledAt: at, disabledBy: c.actor });
      await c.store.updateUser(account.userId, { blocked: true });
      for (const d of await c.store.devices(accountId)) if (d.revokedAt === null) await c.store.updateDevice(d.id, { revokedAt: at });
      await useUpTokens(c, accountId, ['invite', 'reset']);
      await c.sessions.revokeAll(account.userId);
      await c.store.record({ subjectId: accountId, action: PORTAL_ACTIONS.disabled, changes: {}, actor: c.actor });
      return (await c.store.account(accountId)) as AccountRow;
    });
    return done ? blockAnswer(c, done, ACCOUNT_TOASTS.disabled) : refuse(404, PORTAL_ERRORS.notFound);
  });
}

/** `disabled` -> `active` when the coach had activated the account, else back to `invited` (the admin resends the invite). */
export async function enableAccount(c: AccountContext, accountId: string): Promise<AdminResult<AccountAnswer>> {
  return guardedWrite(c, 'portal account enable', async () => {
    if (!(await c.store.account(accountId))) return refuse(404, PORTAL_ERRORS.notFound);
    const done = await c.store.transaction(async () => {
      await c.store.lockAccount(accountId);
      const account = await c.store.account(accountId);
      if (!account || account.status !== 'disabled') return null;
      await c.store.updateAccount(accountId, { status: account.activatedAt ? 'active' : 'invited', disabledAt: null, disabledBy: null });
      await c.store.updateUser(account.userId, { blocked: false });
      await c.store.record({ subjectId: accountId, action: PORTAL_ACTIONS.enabled, changes: {}, actor: c.actor });
      return (await c.store.account(accountId)) as AccountRow;
    });
    return done ? blockAnswer(c, done, ACCOUNT_TOASTS.enabled) : refuse(409, ADMIN_ERRORS.stale);
  });
}
