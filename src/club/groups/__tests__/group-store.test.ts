import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import type { GroupStore } from '../types';
import { exceptionData, recurrenceData, strapiGroupStore, toEventRecord, toGroupRecord, toRecurrence } from '../strapi-store';
import { event } from './fake-group-store';

describe('locks and writes to a missing row', () => {

  const calls: [string, (s: GroupStore) => Promise<unknown>][] = [
    ['updateGroup', (s) => s.updateGroup('nope', { name: 'x' })],
    ['deleteGroup', (s) => s.deleteGroup('nope')],
    ['setAthleteStatus', (s) => s.setAthleteStatus('nope', 'inactiv')],
    ['setSeasonCurrent', (s) => s.setSeasonCurrent('nope', true)],
    ['updateMembership', (s) => s.updateMembership('nope', { isMain: false })],
    ['deleteMembership', (s) => s.deleteMembership('nope')],
    ['updateEvent', (s) => s.updateEvent('nope', { title: 'x' })],
    ['deleteEvent', (s) => s.deleteEvent('nope')],
    ['updateBreak', (s) => s.updateBreak('nope', { label: 'x', startDate: '2026-12-01', endDate: '2026-12-02' })],
    ['deleteBreak', (s) => s.deleteBreak('nope')],
    ['setHistoryChanges', (s) => s.setHistoryChanges('nope', {})],
  ];

  const empty = { update: async () => null, delete: async () => ({ documentId: 'x', entries: [] }) };
  const strapiOfMissing = {
    documents: () => empty,
    db: { query: () => ({ update: async () => null }) },
  } as unknown as Core.Strapi;

  it('the Strapi throws for a missing id' + ' (table)', async () => {
    const __each = async (_name, call) => {
    await expect(call(strapiGroupStore(strapiOfMissing))).rejects.toThrow('the row does not exist');
  };
    for (const row of calls as unknown[]) {
      try {
        await (__each as (...a: unknown[]) => unknown)(...(Array.isArray(row) ? row : [row]));
      } catch (e) {
        throw new Error(`row ${JSON.stringify(row)}: ${(e as Error).message}`);
      }
    }
  });
});

describe('the Strapi row mappers', () => {
  it('maps a group document with its relations', () => {
    expect(toGroupRecord({ documentId: 'g1', name: 'G', section: { documentId: 's' }, order: 2, priceList: { documentId: 'p' }, coaches: [{ documentId: 'c1' }], programPublic: false }))
      .toEqual({ id: 'g1', name: 'G', sectionId: 's', order: 2, active: true, priceListId: 'p', coachIds: ['c1'], programPublic: false });
  });

  it('round-trips a recurrence through the stored shape', () => {
    const r = event({ id: 'e' }).recurrence;
    const stored = recurrenceData(r);
    expect(stored).toMatchObject({ freq: 'weekly', sat: true, sun: true, mon: false, startTime: '11:00:00.000', endTime: '11:50:00.000' });
    expect(toRecurrence(stored)).toEqual(r);
  });

  it('round-trips an exception and reads an event without a recurrence', () => {
    const x = { date: '2026-11-21', kind: 'override' as const, newDate: '2026-11-22', newStartTime: '12:00', newEndTime: '12:50', newTitle: null, reason: 'sala' };
    const stored = exceptionData(x);
    expect(stored.newStartTime).toBe('12:00:00.000');
    expect(toEventRecord({ documentId: 'e', title: 'T', type: 'scoala', exceptions: [stored] }).exceptions).toEqual([x]);
    expect(toEventRecord({ documentId: 'e', title: 'T', type: 'scoala' }).recurrence.freq).toBe('weekly');
  });
});
