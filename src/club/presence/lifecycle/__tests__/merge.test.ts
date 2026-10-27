import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { athleteRow, fakeClubStore } from '../../../athletes/__tests__/fake-store';
import { mergeAthletes } from '../../../athletes/merge';
import { attendanceRow, fakePresenceStore, lessonRow, paymentRow, sessionRow, subscriptionRow } from '../../__tests__/fake-store';
import { usedSlots } from '../../subscriptions';

const SRC = join(__dirname, '../../../..');
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

function setup() {
  const club = fakeClubStore({
    athletes: [athleteRow({ id: 'k', name: 'Maria Pop' }), athleteRow({ id: 'r', name: 'Pop Maria' })],
  });
  const pres = fakePresenceStore({
    sessions: [sessionRow({ id: 's1' }), sessionRow({ id: 's2', date: '2026-11-08' })],
    attendances: [
      attendanceRow({ id: 'tk', sessionId: 's1', athleteId: 'k', uniqueKey: 's1|k', billing: 'slot', subscriptionId: 'subK' }),
      attendanceRow({ id: 'tr', sessionId: 's1', athleteId: 'r', uniqueKey: 's1|r', billing: 'slot', subscriptionId: 'subR' }),
      attendanceRow({ id: 'tr2', sessionId: 's2', athleteId: 'r', uniqueKey: 's2|r', billing: 'slot', subscriptionId: 'subR' }),
    ],
    lessons: [lessonRow({ id: 'lr', athleteId: 'r' })],
    subscriptions: [subscriptionRow({ id: 'subK', athleteId: 'k' }), subscriptionRow({ id: 'subR', athleteId: 'r' })],
    payments: [paymentRow({ id: 'pr', athleteId: 'r' }), paymentRow({ id: 'pr2', athleteId: 'r', cancelled: true })],
  });
  const ctx = { store: club.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 27 }, log: vi.fn() };
  return { club, pres, presence: pres.store, ctx };
}

describe('merge moves presence rows (4.21, C38)', () => {
  it('moves attendance, lessons, abonamente and payments; no double row, the removed slot returns (4.21, C38)', async () => {
    const f = setup();
    expect((await mergeAthletes(f.ctx, { keptId: 'k', removedId: 'r', take: [] }, f.presence)).ok).toBe(true);
    expect(f.pres.state.attendances.map((a) => [a.sessionId, a.athleteId, a.uniqueKey, a.subscriptionId])).toEqual([['s1', 'k', 's1|k', 'subK'], ['s2', 'k', 's2|k', 'subR']]);
    const used = usedSlots(await f.presence.attendances());
    expect([used.get('subK'), used.get('subR')]).toEqual([1, 1]);
    expect([...f.pres.state.lessons, ...f.pres.state.subscriptions, ...f.pres.state.payments].every((x) => x.athleteId === 'k')).toBe(true);
    expect(f.pres.state.payments).toHaveLength(2);
  });

  it('locks registrations and athletes first, then lessons, subscriptions, payments, each sorted (7.1)', async () => {
    const f = setup();
    await mergeAthletes(f.ctx, { keptId: 'k', removedId: 'r', take: [] }, f.presence);
    expect(f.pres.group.locks).toEqual(['lesson:lr', 'subscription:subK', 'subscription:subR', 'payment:pr', 'payment:pr2']);
    expect(f.club.state.locks.slice(-2)).toEqual(['athlete:k', 'athlete:r']);
  });

  it('rolls both stores back when a later step fails', async () => {
    const f = setup();
    f.club.failOn('deleteAthlete');
    expect((await mergeAthletes(f.ctx, { keptId: 'k', removedId: 'r', take: [] }, f.presence)).ok).toBe(false);
    expect(f.pres.state.attendances.map((a) => a.athleteId).sort()).toEqual(['k', 'r', 'r']);
    expect(f.pres.state.payments.every((p) => p.athleteId === 'r')).toBe(true);
  });

  it('the merge handler passes a presence store', () => {
    expect(source('api/club/controllers/athletes.ts')).toMatch(/mergeAthletes\(await serviceContext\(strapi, ctx\), request, strapiPresenceStore\(strapi\)\)/);
  });
});
