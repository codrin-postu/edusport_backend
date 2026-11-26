import type { Core } from '@strapi/strapi';
import { transactionScope } from '../athletes/strapi-store';
import { strapiSecurityStore } from '../security/strapi-store';
import { parseProgress, type Progress } from './progress';

const TABLE = 'admin_accounts';

/** What a progress change needs from storage; the real one is `strapiPort`, tests use a fake. */
export type ProgressPort = {
  transaction: <T>(work: () => Promise<T>) => Promise<T>;
  /** The caller's account row (created when missing): its document id. */
  ensureAccount: (adminUserId: number) => Promise<string>;
  /** Row lock inside the open transaction. */
  lock: (accountId: string) => Promise<void>;
  /** Read through the transaction's connection. */
  read: (accountId: string) => Promise<unknown>;
  write: (accountId: string, next: Progress) => Promise<void>;
};

/** Create the row if needed, lock it, re-read, change and write: concurrent marks of one admin queue up and none is lost. */
export function changeWith(port: ProgressPort, adminUserId: number, change: (p: Progress) => Progress): Promise<Progress> {
  return port.transaction(async () => {
    const accountId = await port.ensureAccount(adminUserId);
    await port.lock(accountId);
    const next = change(parseProgress(await port.read(accountId)));
    await port.write(accountId, next);
    return next;
  });
}

function asValue(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function strapiPort(strapi: Core.Strapi): ProgressPort {
  const scope = transactionScope(strapi);
  const security = strapiSecurityStore(strapi);
  const query = () => {
    const trx = scope.current();
    if (!trx) throw new Error('onboarding row used outside a transaction');
    return strapi.db.getConnection(TABLE).transacting(trx);
  };
  return {
    transaction: scope.transaction,
    ensureAccount: async (adminUserId) => (await security.ensureAdminAccount(adminUserId)).id,
    lock: (id) => scope.lockRow(TABLE, id),
    read: async (id) => asValue((await query().where('document_id', id).select('onboarding').first())?.onboarding),
    write: async (id, next) => {
      await query().where('document_id', id).update({ onboarding: JSON.stringify(next) });
    },
  };
}

/** One admin's progress, changed under the row lock; the `admin_accounts` row is created when missing. */
export const changeProgress = (strapi: Core.Strapi, adminUserId: number, change: (p: Progress) => Progress): Promise<Progress> =>
  changeWith(strapiPort(strapi), adminUserId, change);

/** The caller's own progress; no row yet reads as empty. */
export async function readProgress(strapi: Core.Strapi, adminUserId: number): Promise<Progress> {
  const row = await strapi.db.getConnection(TABLE).where('admin_user_id', adminUserId).select('onboarding').first();
  return parseProgress(asValue(row?.onboarding));
}
