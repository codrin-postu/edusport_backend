import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { UniqueKeyError } from '../store';
import {
  asUniqueKeyError, strapiPresenceStore, toAttendanceRow, toLessonRow, toPaymentRow, toPriceListRecord, toSessionRow, toSubscriptionRow,
} from '../strapi-store';
import { fakePresenceStore } from './fake-store';

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

describe('strapiPresenceStore', () => {
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
      clubMonth: null, season: { documentId: 's26' }, collectedAtRink: true, note: 'x', sendEmail: true, emailJob: { documentId: 'j1' }, acsBefore: 'nu', recordedBy: 'Ana',
      recordedAt: '2026-10-27T10:00:00.000Z', cancelled: null, cancelledAt: null, cancelledBy: null,
    })).toEqual({
      id: 'p1', athleteId: 'a1', amount: 320, method: 'card', paidOn: '2026-10-27', purpose: 'abonament', subscriptionId: 'sub1', lessonId: null, clubMonth: null, seasonId: 's26',
      collectedAtRink: true, note: 'x', sendEmail: true, emailJobId: 'j1', acsBefore: 'nu', recordedBy: 'Ana', recordedAt: '2026-10-27T10:00:00.000Z', cancelled: false, cancelledAt: null, cancelledBy: null,
    });
    expect(toSubscriptionRow({
      documentId: 'sub1', athlete: { documentId: 'a1' }, season: { documentId: 's26' }, priceList: { documentId: 'pl-std' }, validIn: [{ documentId: 'pl-std' }, { documentId: 'pl-gold' }],
      itemName: 'Abonament 8 ședințe', price: '320.00', audience: 'nonMember', slots: 8, startsOn: '2026-10-27', validUntil: '2026-11-23', extendedWeeks: 1, cancelled: true,
      cancelledAt: '2026-11-01T10:00:00.000Z', cancelledBy: 'Ana', purchasedAt: '2026-10-27T10:00:00.000Z', recordedBy: 'Ana',
    })).toEqual({
      id: 'sub1', athleteId: 'a1', seasonId: 's26', priceListId: 'pl-std', validIn: ['pl-std', 'pl-gold'], itemName: 'Abonament 8 ședințe', price: 320, audience: 'nonMember', slots: 8,
      startsOn: '2026-10-27', validUntil: '2026-11-23', extendedWeeks: 1, cancelled: true, cancelledAt: '2026-11-01T10:00:00.000Z', cancelledBy: 'Ana',
      purchasedAt: '2026-10-27T10:00:00.000Z', recordedBy: 'Ana',
    });
    expect(toSubscriptionRow({ documentId: 'sub2', validIn: [] }).validIn).toEqual([]);
    expect(toLessonRow({
      documentId: 'l1', athlete: { documentId: 'a1' }, date: '2026-11-10', startTime: '17:00:00.000', durationMin: 50, coaches: [{ documentId: 'tm-andreea' }], state: 'saved', present: true,
      priceList: { documentId: 'pl-club' }, itemName: 'Lecție individuală', price: '80.00', audience: 'member', amount: '80.00', createdBy: 'Ana', savedBy: 'Ana', savedAt: '2026-11-10T18:00:00.000Z',
    })).toEqual({
      id: 'l1', athleteId: 'a1', date: '2026-11-10', startTime: '17:00', durationMin: 50, coachIds: ['tm-andreea'], state: 'saved', present: true, priceListId: 'pl-club',
      itemName: 'Lecție individuală', price: 80, audience: 'member', amount: 80, createdBy: 'Ana', savedBy: 'Ana', savedAt: '2026-11-10T18:00:00.000Z',
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
      await store.lockSubscription('sub1');
      await store.lockPayment('p1');
      await store.lockHistoryEntry('h1');
    });
    const tables = calls.filter((c) => c.includes('document_id=')).map((c) => c.split(' document_id=').join(':'));
    expect(tables).toEqual([
      'seasons:se1', 'athletes:a1', 'club_groups:g1', 'calendar_events:ev1', 'club_sessions:s1', 'club_individual_lessons:l1', 'club_subscriptions:sub1', 'club_payments:p1', 'history_entries:h1',
    ]);
    expect(calls.filter((c) => c.endsWith('in trx'))).toHaveLength(9);
  });

  it('the fake refuses season, group and event locks outside a transaction too', async () => {
    const { store } = fakePresenceStore();
    for (const lock of [store.lockSeason, store.lockGroup, store.lockEvent]) await expect(lock('x')).rejects.toThrow();
  });

  it('a lock outside a transaction throws', async () => {
    const calls: string[] = [];
    await expect(strapiPresenceStore(lockingStrapi(calls)).lockPayment('p1')).rejects.toThrow('outside a transaction');
    expect(calls).toEqual([]);
  });
});
