import { refuse, type AdminResult } from '../../admin-result';
import { PORTAL_ACTIONS, PORTAL_ERRORS } from '../copy';
import { ACCOUNT_TOASTS } from '../copy-admin';
import type { AccountRow } from '../store';
import type { AccountAnswer } from './api-types';
import { answer, emailOf, guardedWrite, queueFreshInvite, useUpTokens } from './invite';
import { blockOf, type AccountContext } from './read';

type Changed = { before: AccountRow; after: AccountRow; jobId: string | null };

/** The notice goes to the old and the new address after commit; a failure is logged (never the address) and changes nothing. */
async function notify(c: AccountContext, from: string, to: string): Promise<void> {
  for (const address of [from, to]) {
    try {
      if (!(await c.mail(address, { kind: 'email-changed', newEmail: to }))) c.log('[portal] the e-mail change notice was not sent');
    } catch (err) {
      c.log(`[portal] the e-mail change notice failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/** 10.1: the new address on the account and the user, open reset codes used up, an invited account gets a new invite. */
export async function changeEmail(c: AccountContext, accountId: string, body: unknown): Promise<AdminResult<AccountAnswer>> {
  return guardedWrite(c, 'portal account e-mail change', async () => {
    const email = emailOf(body);
    if (email === null) return refuse(400, PORTAL_ERRORS.invalid);
    const known = await c.store.account(accountId);
    if (!known) return refuse(404, PORTAL_ERRORS.notFound);
    const holder = await c.store.accountByEmail(email);
    if (holder && holder.id !== accountId) return refuse(409, PORTAL_ERRORS.emailTaken);
    const changed = await c.store.transaction(async (): Promise<Changed | null> => {
      await c.store.lockAccount(accountId);
      const before = await c.store.account(accountId);
      if (!before) return null;
      if (before.email === email) return { before, after: before, jobId: null };
      await c.store.updateAccount(accountId, { email });
      await c.store.updateUser(before.userId, { email });
      await useUpTokens(c, accountId, before.status === 'invited' ? ['reset', 'invite'] : ['reset']);
      let jobId: string | null = null;
      if (before.status === 'invited') {
        const name = before.teamMemberId ? await c.store.teamMemberName(before.teamMemberId) : null;
        if (name !== null) jobId = await queueFreshInvite(c, before, name, email);
      }
      await c.store.record({ subjectId: accountId, action: PORTAL_ACTIONS.emailChanged, changes: { from: before.email, to: email }, actor: c.actor });
      return { before, after: (await c.store.account(accountId)) as AccountRow, jobId };
    });
    if (!changed) return refuse(404, PORTAL_ERRORS.notFound);
    if (changed.before.email !== changed.after.email) {
      if (changed.jobId) c.afterCommit(changed.jobId);
      await notify(c, changed.before.email, changed.after.email);
    }
    return answer(blockOf(changed.after.teamMemberId ?? '', changed.after), ACCOUNT_TOASTS.emailChanged);
  });
}
