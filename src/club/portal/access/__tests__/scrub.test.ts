import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { strapiAccessStore } from '../strapi-store';

type Row = Record<string, unknown>;

/** A strapi double: the access rows of one athlete, no history lines, and the e-mail jobs the scrub reads and updates. */
function fake(jobs: Row[], accountId = 'acc1') {
  const updates: { id: unknown; data: Row }[] = [];
  const strapi = {
    documents: () => ({ findMany: async () => [{ documentId: 'row1', account: { documentId: accountId }, athlete: { documentId: 'a1' } }] }),
    db: {
      query: (uid: string) => ({
        findMany: async () => (uid.includes('email-job') ? jobs : []),
        updateMany: async () => 0,
        update: async ({ where, data }: { where: { id: unknown }; data: Row }) => { updates.push({ id: where.id, data }); },
      }),
    },
  } as unknown as Core.Strapi;
  return { store: strapiAccessStore(strapi, {} as never), updates };
}

describe('anonymize scrub of the queued access mails', () => {
  it('matches by athlete id: a same-name sibling on the same account keeps its job', async () => {
    const own = { id: 1, kind: 'portal-access', status: 'pending', payload: { childName: 'Ana Pop', athleteIds: ['a1'] } };
    const sibling = { id: 2, kind: 'portal-access', status: 'pending', payload: { childName: 'Ana Pop', athleteIds: ['a2'] } };
    const { store, updates } = fake([own, sibling]);
    await store.scrubForAthlete('a1', 'Ana Pop');
    expect(updates.map((u) => u.id)).toEqual([1]);
    expect(updates[0]?.data.payload).toBeNull();
  });

  it('a multi-child invite keeps its job and drops only the anonymized child', async () => {
    const job = { id: 3, kind: 'portal-invite', status: 'pending', payload: { name: 'P', link: 'l', host: 'h', children: ['Ana Pop', 'Ana Pop'], athleteIds: ['a2', 'a1'] } };
    const { store, updates } = fake([job]);
    await store.scrubForAthlete('a1', 'Ana Pop');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.data.payload).toEqual({ name: 'P', link: 'l', host: 'h', children: ['Ana Pop'], athleteIds: ['a2'] });
    expect(updates[0]?.data.recipient).toBeUndefined();
  });

  it('a job queued before the ids were stored still falls back to the child name', async () => {
    const { store, updates } = fake([{ id: 4, kind: 'portal-invite', status: 'pending', payload: { name: 'P', link: 'l', host: 'h', children: ['Ana Pop'] } }]);
    await store.scrubForAthlete('a1', 'Ana Pop');
    expect(updates[0]?.data.payload).toBeNull();
  });
});
