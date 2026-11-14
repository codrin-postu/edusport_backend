import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { UniqueKeyError } from '../store';
import {
  asUniqueKeyError, strapiPresenceStore, toAttendanceRow, toLessonRow, toPaymentRow, toPriceListRecord, toSessionRow, toSubscriptionRow,
} from '../strapi-store';
import { fakePresenceStore } from './fake-store';

function queryingStrapi(seen: { table: string; where: unknown }[]): Core.Strapi {
  const db = {
    query: (table: string) => ({
      findMany: async (args: { where: unknown }) => {
        seen.push({ table, where: args.where });
        return [];
      },
    }),
  };
  return { db } as unknown as Core.Strapi;
}

function lockingStrapi(calls: string[]): Core.Strapi {
  const chain = (table: string) => {
    const step = (text: string) => {
      calls.push(`${table} ${text}`);
      return q;
    };
    const q = {
      transacting: (trx: string) => step(`in ${trx}`),
      forUpdate: () => step('for update'),
      where: (col: string, id: string) => step(`${col}=${id}`),
      select: async () => [],
    };
    return q;
  };
  const db = { getConnection: chain, transaction: async (work: (a: { trx: string }) => Promise<unknown>) => work({ trx: 'trx' }) };
  return { db } as unknown as Core.Strapi;
}

function countingStrapi(calls: string[]): Core.Strapi {
  const chain = (table: string) => {
    calls.push(table);
    const q = {
      transacting: (trx: string) => {
        calls[calls.length - 1] = `${table} in ${trx}`;
        return q;
      },
      insert: (row: { key: string; value: number }) => {
        calls.push(`insert key=${row.key} value=${row.value}`);
        return q;
      },
      onConflict: (col: string) => {
        calls.push(`onConflict ${col}`);
        return q;
      },
      merge: (data: { value: unknown }) => {
        calls.push(`merge ${String(data.value)}`);
        return q;
      },
      returning: async (col: string) => {
        calls.push(`returning ${col}`);
        return [{ value: 7 }];
      },
    };
    return q;
  };
  const raw = (sql: string, args: unknown[] = []) => (sql.startsWith('greatest') ? `greatest(${args.join(',')})` : 'value+1');
  const db = { getConnection: chain, connection: { raw }, transaction: async (work: (a: { trx: string }) => Promise<unknown>) => work({ trx: 'trx' }) };
  return { db } as unknown as Core.Strapi;
}

describe('strapiPresenceStore', () => {
  it('the Strapi counter is one upsert in the open transaction', async () => {
    const calls: string[] = [];
    const store = strapiPresenceStore(countingStrapi(calls));
    expect(await store.transaction(() => store.nextCounter('subscription'))).toBe(7);
    expect(calls).toEqual(['club_counters in trx', 'insert key=subscription value=1', 'onConflict key', 'merge value+1', 'returning value']);
  });

  it('raising a counter is one upsert with greatest, and a counter outside a transaction throws', async () => {
    const calls: string[] = [];
    const store = strapiPresenceStore(countingStrapi(calls));
    await store.transaction(() => store.raiseCounter('receipt:2026', 40));
    expect(calls).toEqual(['club_counters in trx', 'insert key=receipt:2026 value=40', 'onConflict key', 'merge greatest(40)', 'returning value']);
    await expect(store.nextCounter('subscription')).rejects.toThrow('counter taken outside a transaction');
    await expect(store.raiseCounter('subscription', 1)).rejects.toThrow('counter taken outside a transaction');
  });

  it('has exactly the methods of the fake store (11.2)', () => {
    expect(Object.keys(strapiPresenceStore({} as Core.Strapi)).sort()).toEqual(Object.keys(fakePresenceStore().store).sort());
  });

  it('maps a session with its relations', () => {
    expect(toSessionRow({
      documentId: 's1', group: { documentId: 'g-ib' }, season: { documentId: 's26' }, date: '2026-11-07', startTime: '11:00:00.000', durationMin: 50, source: 'schedule',
      event: { documentId: 'ev1' }, occurrenceKey: 'ev1|2026-11-07|11:00', outsideSchedule: null, coaches: [{ documentId: 'tm-virgil' }], savedBy: 'Ana',
      savedAt: '2026-11-07T10:00:00.000Z', firstSavedAt: '2026-11-07T10:00:00.000Z',
    })).toEqual({
      id: 's1', groupId: 'g-ib', seasonId: 's26', date: '2026-11-07', startTime: '11:00', durationMin: 50, source: 'schedule', eventId: 'ev1',
      occurrenceKey: 'ev1|2026-11-07|11:00', outsideSchedule: false, coachIds: ['tm-virgil'], savedBy: 'Ana', savedAt: '2026-11-07T10:00:00.000Z', firstSavedAt: '2026-11-07T10:00:00.000Z',
    });
  });

  it('reads decimals given as text and keeps charges', () => {
    const row = toAttendanceRow({
      documentId: 't1', session: { documentId: 's1', date: '2026-11-07', group: { documentId: 'g-av' } }, athlete: { documentId: 'a1' }, uniqueKey: 's1|a1', grup: true,
      uscat: false, visitor: false, subscription: null, billing: 'club', charges: [{ type: 'grup', itemName: 'Ședință grup', price: 40, included: false }], amount: '40.00', audience: 'member',
    });
    expect([row.amount, row.sessionDate, row.groupId, row.subscriptionId]).toEqual([40, '2026-11-07', 'g-av', null]);
    expect(row).toMatchObject({
      id: 't1', sessionId: 's1', athleteId: 'a1', uniqueKey: 's1|a1', grup: true, uscat: false, visitor: false, billing: 'club', audience: 'member',
      charges: [{ type: 'grup', itemName: 'Ședință grup', price: 40, included: false }],
    });
  });

  it('maps payments, subscriptions (validIn ids), lessons and price lists (items with included)', () => {
    expect(toPaymentRow({
      documentId: 'p1', athlete: { documentId: 'a1' }, amount: '320.00', method: 'card', paidOn: '2026-10-27', purpose: 'abonament', subscription: { documentId: 'sub1' }, lesson: null,
      clubMonth: null, season: { documentId: 's26' }, collectedAtRink: true, note: 'x', sendEmail: true, emailJob: { documentId: 'j1' }, receiptNo: '2026-0412', acsBefore: 'nu', recordedBy: 'Ana',
      recordedAt: '2026-10-27T10:00:00.000Z', cancelled: null, cancelledAt: null, cancelledBy: null,
    })).toEqual({
      id: 'p1', receiptNo: '2026-0412', athleteId: 'a1', amount: 320, method: 'card', paidOn: '2026-10-27', purpose: 'abonament', subscriptionId: 'sub1', lessonId: null, clubMonth: null, seasonId: 's26',
      collectedAtRink: true, note: 'x', sendEmail: true, emailJobId: 'j1', acsBefore: 'nu', recordedBy: 'Ana', recordedAt: '2026-10-27T10:00:00.000Z', cancelled: false, cancelledAt: null, cancelledBy: null,
    });
    expect(toSubscriptionRow({
      documentId: 'sub1', athlete: { documentId: 'a1' }, season: { documentId: 's26' }, priceList: { documentId: 'pl-std' }, validIn: [{ documentId: 'pl-std' }, { documentId: 'pl-gold' }],
      itemName: 'Abonament 8 ședințe', price: '320.00', audience: 'nonMember', slots: 8, startsOn: '2026-10-27', validUntil: '2026-11-23', extendedWeeks: 1, cancelled: true,
      cancelledAt: '2026-11-01T10:00:00.000Z', cancelledBy: 'Ana', purchasedAt: '2026-10-27T10:00:00.000Z', recordedBy: 'Ana', code: 'A-0124',
    })).toEqual({
      id: 'sub1', code: 'A-0124', athleteId: 'a1', seasonId: 's26', priceListId: 'pl-std', validIn: ['pl-std', 'pl-gold'], itemName: 'Abonament 8 ședințe', price: 320, audience: 'nonMember', slots: 8,
      startsOn: '2026-10-27', validUntil: '2026-11-23', extendedWeeks: 1, cancelled: true, cancelledAt: '2026-11-01T10:00:00.000Z', cancelledBy: 'Ana',
      purchasedAt: '2026-10-27T10:00:00.000Z', recordedBy: 'Ana',
    });
    expect(toSubscriptionRow({ documentId: 'sub2', validIn: [] })).toMatchObject({ validIn: [], code: null });
    expect(toPaymentRow({ documentId: 'p2' }).receiptNo).toBeNull();
    expect(toLessonRow({
      documentId: 'l1', athlete: { documentId: 'a1' }, date: '2026-11-10', startTime: '17:00:00.000', durationMin: 50, coaches: [{ documentId: 'tm-andreea' }], state: 'saved', present: true,
      priceList: { documentId: 'pl-club' }, itemName: 'Lecție individuală', price: '80.00', audience: 'member', amount: '80.00', createdByName: 'Ana', recordedAt: '2026-11-10T17:30:00.000Z', savedBy: 'Ana', savedAt: '2026-11-10T18:00:00.000Z',
      movedFromDate: '2026-11-09', movedFromTime: '16:00:00.000',
    })).toEqual({
      id: 'l1', athleteId: 'a1', date: '2026-11-10', startTime: '17:00', durationMin: 50, coachIds: ['tm-andreea'], state: 'saved', present: true, priceListId: 'pl-club',
      itemName: 'Lecție individuală', price: 80, audience: 'member', amount: 80, createdByName: 'Ana', recordedAt: '2026-11-10T17:30:00.000Z', savedBy: 'Ana', savedAt: '2026-11-10T18:00:00.000Z', seriesId: null, movedFromDate: '2026-11-09', movedFromTime: '16:00',
    });
    expect(toLessonRow({ documentId: 'l2', state: 'planned', present: null })).toMatchObject({ present: null, priceListId: null, price: null, amount: 0, savedAt: null });
    expect(toPriceListRecord({
      documentId: 'pl-club', name: 'Club', section: { documentId: 'club' },
      items: [{ name: 'Ședință grup', kind: 'session', sessions: null, memberPrice: '40.00', nonMemberPrice: 50, included: null }, { name: 'Uscat', kind: 'uscat', sessions: 4, memberPrice: 20, nonMemberPrice: null, included: true }],
    })).toEqual({
      id: 'pl-club', name: 'Club', sectionId: 'club',
      items: [
        { name: 'Ședință grup', kind: 'session', sessions: null, memberPrice: 40, nonMemberPrice: 50, included: false },
        { name: 'Uscat', kind: 'uscat', sessions: 4, memberPrice: 20, nonMemberPrice: null, included: true },
      ],
    });
  });

  it('turns a duplicate key into UniqueKeyError (decided 4)', () => {
    expect(asUniqueKeyError({ code: '23505' })).toBeInstanceOf(UniqueKeyError);
    expect(asUniqueKeyError({ cause: { code: '23505' } })).toBeInstanceOf(UniqueKeyError);
    expect(asUniqueKeyError(Object.assign(new Error('This attribute must be unique'), { name: 'ValidationError' }))).toBeInstanceOf(UniqueKeyError);
    expect(asUniqueKeyError(new Error('connection lost'))).toBeNull();
  });

  it('a create carries the code or the number, an update never does', async () => {
    const created: Array<Record<string, unknown>> = [];
    const updated: Array<Record<string, unknown>> = [];
    const strapi = { documents: () => ({
      create: async (args: { data: Record<string, unknown> }) => { created.push(args.data); return { documentId: 'x1' }; },
      update: async (args: { data: Record<string, unknown> }) => { updated.push(args.data); return { documentId: 'x1' }; },
    }) } as unknown as Core.Strapi;
    const store = strapiPresenceStore(strapi);
    await store.createSubscription({ athleteId: 'a1', itemName: 'x' } as never, 'A-0124');
    await store.createPayment({ athleteId: 'a1', amount: 1 } as never, '2026-0412');
    await store.updateSubscription('x1', { cancelled: true });
    await store.updatePayment('x1', { note: 'n' });
    expect(created).toEqual([{ athlete: 'a1', itemName: 'x', code: 'A-0124' }, { athlete: 'a1', amount: 1, receiptNo: '2026-0412' }]);
    expect(updated.every((d) => !('code' in d) && !('receiptNo' in d))).toBe(true);
  });

  it('never sends Strapi\'s reserved createdBy in a lesson create payload', async () => {
    const created: Array<{ data: Record<string, unknown> }> = [];
    const strapi = { documents: () => ({ create: async (args: { data: Record<string, unknown> }) => { created.push(args); return { documentId: 'l1' }; } }) } as unknown as Core.Strapi;
    await strapiPresenceStore(strapi).createLesson({
      athleteId: 'a1', date: '2026-11-10', startTime: '17:00', durationMin: 50, coachIds: [], state: 'planned', present: null, priceListId: null, itemName: null, price: null,
      audience: null, amount: 0, createdByName: 'Ana', recordedAt: '2026-11-10T17:30:00.000Z', savedBy: null, savedAt: null,
    } as never);
    expect(created).toHaveLength(1);
    expect(created[0].data).toHaveProperty('createdByName', 'Ana');
    expect(Object.keys(created[0].data)).not.toContain('createdBy');
  });

  it('lesson cancellations: a create keeps the athlete as plain id, reads by athlete and range, prune deletes before a date', async () => {
    const created: Array<Record<string, unknown>> = [];
    const wheres: unknown[] = [];
    const strapi = {
      documents: () => ({ create: async (args: { data: Record<string, unknown> }) => { created.push(args.data); return { documentId: 'c1' }; } }),
      db: { query: () => ({
        findOne: async () => null,
        findMany: async (args: { where: unknown }) => { wheres.push(args.where); return [{ date: '2026-11-24', startTime: '16:00:00.000', durationMin: 50 }]; },
        deleteMany: async (args: { where: unknown }) => { wheres.push(args.where); return { count: 3 }; },
      }) },
    } as unknown as Core.Strapi;
    const store = strapiPresenceStore(strapi);
    await store.recordLessonCancel({ athleteId: 'a1', date: '2026-11-24', startTime: '16:00', durationMin: 50 });
    expect(created).toEqual([{ athleteId: 'a1', date: '2026-11-24', startTime: '16:00', durationMin: 50 }]);
    expect(await store.lessonCancels({ athleteId: 'a1', from: '2026-11-01', to: '2026-11-30' })).toEqual([{ date: '2026-11-24', startTime: '16:00', durationMin: 50 }]);
    expect(await store.pruneLessonCancels('2026-11-20')).toBe(3);
    await store.dropLessonCancels('a1');
    expect(wheres).toEqual([{ athleteId: 'a1', date: { $gte: '2026-11-01', $lte: '2026-11-30' } }, { date: { $lt: '2026-11-20' } }, { athleteId: 'a1' }]);
  });

  it('takes every lock inside one transaction scope', async () => {
    const calls: string[] = [];
    const store = strapiPresenceStore(lockingStrapi(calls));
    await store.transaction(async () => {
      await store.lockSeason('se1');
      await store.lockAthlete('a1');
      await store.lockGroup('g1');
      await store.lockEvent('ev1');
      await store.lockSession('s1');
      await store.lockLesson('l1');
      await store.lockAttendance('t1');
      await store.lockSubscription('sub1');
      await store.lockPayment('p1');
      await store.lockHistoryEntry('h1');
    });
    const tables = calls.filter((c) => c.includes('document_id=')).map((c) => c.split(' document_id=').join(':'));
    expect(tables).toEqual([
      'seasons:se1', 'athletes:a1', 'club_groups:g1', 'calendar_events:ev1', 'club_sessions:s1', 'club_individual_lessons:l1', 'club_attendances:t1', 'club_subscriptions:sub1', 'club_payments:p1', 'history_entries:h1',
    ]);
    expect(calls.filter((c) => c.endsWith('in trx'))).toHaveLength(10);
  });

  it('the fake refuses season, group and event locks outside a transaction too', async () => {
    const { store } = fakePresenceStore();
    for (const lock of [store.lockSeason, store.lockGroup, store.lockEvent]) await expect(lock('x')).rejects.toThrow();
  });

  it('a lock outside a transaction throws', async () => {
    const calls: string[] = [];
    await expect(strapiPresenceStore(lockingStrapi(calls)).lockPayment('p1')).rejects.toThrow('outside a transaction');
    await expect(strapiPresenceStore(lockingStrapi(calls)).lockAttendance('t1')).rejects.toThrow('outside a transaction');
    expect(calls).toEqual([]);
  });

  describe('open-ended date ranges (Postgres rejects undefined bounds)', () => {
    const ranges = [
      { name: 'from only', w: { from: '2026-11-01' }, filter: { $gte: '2026-11-01' } },
      { name: 'to only', w: { to: '2026-11-30' }, filter: { $lte: '2026-11-30' } },
      { name: 'both', w: { from: '2026-11-01', to: '2026-11-30' }, filter: { $gte: '2026-11-01', $lte: '2026-11-30' } },
      { name: 'neither', w: {}, filter: undefined },
    ];
    const reads = [
      { name: 'sessions', run: (s: ReturnType<typeof strapiPresenceStore>, w: { from?: string; to?: string }) => s.sessions(w), where: (f: unknown) => (f ? { date: f } : {}) },
      { name: 'attendances', run: (s: ReturnType<typeof strapiPresenceStore>, w: { from?: string; to?: string }) => s.attendances(w), where: (f: unknown) => (f ? { session: { date: f } } : {}) },
      { name: 'lessons', run: (s: ReturnType<typeof strapiPresenceStore>, w: { from?: string; to?: string }) => s.lessons(w), where: (f: unknown) => (f ? { date: f } : {}) },
      { name: 'payments', run: (s: ReturnType<typeof strapiPresenceStore>, w: { from?: string; to?: string }) => s.payments(w), where: (f: unknown) => (f ? { paidOn: f } : {}) },
    ];
    it('every read builds exactly the bound(s) that are set', async () => {
      for (const read of reads) {
        for (const range of ranges) {
          const seen: { table: string; where: unknown }[] = [];
          await read.run(strapiPresenceStore(queryingStrapi(seen)), range.w);
          expect(seen, `${read.name}: ${range.name}`).toHaveLength(1);
          expect(seen[0].where, `${read.name}: ${range.name}`).toStrictEqual(read.where(range.filter));
        }
      }
    });
  });

  it('history pages are one count and one limited query each, ordered through the session (11.3)', async () => {
    const seen: { table: string; op: string; args: Record<string, unknown> }[] = [];
    const db = {
      query: (table: string) => ({
        findMany: async (args: Record<string, unknown>) => { seen.push({ table, op: 'findMany', args }); return []; },
        count: async (args: Record<string, unknown>) => { seen.push({ table, op: 'count', args }); return 0; },
      }),
    };
    const store = strapiPresenceStore({ db } as unknown as Core.Strapi);
    await store.athleteAttendancePage('a1', '2026-10-01', '2027-05-31', 20);
    await store.athleteLessonPage('a1', '2026-10-01', '2027-05-31', 20);
    const where = { athlete: { documentId: 'a1' }, session: { date: { $gte: '2026-10-01', $lte: '2027-05-31' } } };
    const lessonWhere = { athlete: { documentId: 'a1' }, present: true, date: { $gte: '2026-10-01', $lte: '2027-05-31' } };
    expect(seen.map((c) => [c.table, c.op])).toEqual([
      ['api::attendance.attendance', 'findMany'], ['api::attendance.attendance', 'count'], ['api::individual-lesson.individual-lesson', 'findMany'], ['api::individual-lesson.individual-lesson', 'count'],
    ]);
    expect(seen[0].args).toMatchObject({ where, limit: 20, orderBy: [{ session: { date: 'desc' } }, { session: { startTime: 'desc' } }, { documentId: 'desc' }] });
    expect(seen[1].args).toStrictEqual({ where });
    expect(seen[2].args).toMatchObject({ where: lessonWhere, limit: 20, orderBy: [{ date: 'desc' }, { startTime: 'desc' }, { documentId: 'desc' }] });
    expect(seen[3].args).toStrictEqual({ where: lessonWhere });
  });
});
