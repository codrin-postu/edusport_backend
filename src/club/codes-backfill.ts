import type { Core } from '@strapi/strapi';
import { SUBSCRIPTION_KEY, planCodeBackfill, type BackfillInput } from './codes';
import { transactionScope, text, str } from './athletes/strapi-store';
import { strapiCounters } from './presence/strapi-store';

const SUBSCRIPTION = 'api::subscription.subscription' as const;
const TABLE = 'club_subscriptions';

export type CodesBackfillPorts = {
  transaction: <T>(work: () => Promise<T>) => Promise<T>;
  lockAll: () => Promise<void>;
  rows: () => Promise<BackfillInput[]>;
  setCode: (id: string, code: string) => Promise<void>;
  counterValue: (key: string) => Promise<number>;
  raiseCounter: (key: string, n: number) => Promise<void>;
};

/**
 * Gives every abonament without a code the next one, oldest purchase first, after the highest code in use, in one transaction.
 * The counter row is locked (a raise by 0) before it is read, so a create at the same moment cannot take a number the plan also hands out;
 * a table with nothing to number is not touched at all (S64).
 */
export async function runCodesBackfill(ports: CodesBackfillPorts, log: (message: string) => void): Promise<{ assigned: number }> {
  const assigned = await ports.transaction(async () => {
    await ports.lockAll();
    const rows = await ports.rows();
    if (!rows.some((r) => !r.code)) return 0;
    await ports.raiseCounter(SUBSCRIPTION_KEY, 0);
    const plan = planCodeBackfill(rows, await ports.counterValue(SUBSCRIPTION_KEY));
    for (const { id, code } of plan.assign) await ports.setCode(id, code);
    await ports.raiseCounter(SUBSCRIPTION_KEY, plan.counterAtLeast);
    return plan.assign.length;
  });
  if (assigned > 0) log(`[codes] backfill: ${assigned} abonamente`);
  return { assigned };
}

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : str(v));

export function codesBackfillPorts(strapi: Core.Strapi): CodesBackfillPorts {
  const scope = transactionScope(strapi);
  const trx = () => {
    const current = scope.current();
    if (!current) throw new Error(`${TABLE} read outside a transaction`);
    return current;
  };
  return {
    transaction: scope.transaction,
    lockAll: async () => {
      await strapi.db.getConnection(TABLE).transacting(trx()).forUpdate().whereNull('code').select('id');
    },
    rows: async () => {
      const found: Record<string, unknown>[] = await strapi.db.getConnection(TABLE).transacting(trx()).select('document_id', 'id', 'purchased_at', 'created_at', 'code');
      return found.map((r) => ({ id: text(r.document_id), purchasedAt: iso(r.purchased_at), createdAt: iso(r.created_at), numericId: Number(r.id), code: str(r.code) }));
    },
    setCode: async (id, code) => {
      await strapi.db.query(SUBSCRIPTION).update({ where: { documentId: id }, data: { code } });
    },
    ...strapiCounters(strapi, scope),
  };
}
