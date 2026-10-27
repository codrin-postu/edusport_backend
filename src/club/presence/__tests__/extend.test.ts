import { describe, expect, it } from 'vitest';
import type { AdminResult } from '../../admin-result';
import { historyTexts } from '../../history-text';
import { extendPreview, extendSubscriptions } from '../subscriptions/extend';
import { undoPresenceAction } from '../undo-service';
import { athleteRow, attendanceRow, fakePresenceContext, sessionRow, subscriptionRow, type FakePresenceContext, type FakePresenceSeed } from './fake-store';

function seed(): FakePresenceSeed {
  const sub = (id: string, athleteId: string, over: object) => subscriptionRow({ id, athleteId, startsOn: '2026-10-27', validUntil: '2026-11-23', ...over });
  return {
    group: {
      athletes: ['a', 'b', 'c', 'd', 'e'].map((x, i) => athleteRow({ id: `a${i + 1}`, name: `Sportiv ${x}` })),
      admins: { 'admin@example.com': 'Admin Test' },
    },
    subscriptions: [
      sub('a', 'a1', {}),
      sub('b', 'a2', { startsOn: '2026-10-24', validUntil: '2026-11-20' }),
      sub('c', 'a3', { startsOn: '2026-10-23', validUntil: '2026-11-19' }),
      sub('d', 'a4', { slots: 1 }),
      sub('e', 'a5', { cancelled: true }),
    ],
    sessions: [sessionRow({ id: 's1' })],
    attendances: [attendanceRow({ id: 'u1', sessionId: 's1', athleteId: 'a4', uniqueKey: 's1|a4', subscriptionId: 'd', billing: 'slot' })],
  };
}

function actionIdOf(r: AdminResult<{ value: unknown; actionId: string | null }>): string {
  if (!r.ok || r.data.actionId === null) throw new Error(`expected an action id, got ${JSON.stringify(r)}`);
  return r.data.actionId;
}
const historyOf = (f: FakePresenceContext, type: string, id: string): string[] =>
  f.group.history.filter((h) => h.subjectType === type && h.subjectId === id).flatMap((h) => historyTexts(h.action, h.changes, h.subjectType));
const keyOf = async (f: FakePresenceContext): Promise<string> => (await extendPreview(f.store, '2026-11-20')).key;

describe('extend the abonamente', () => {
  it('the preview counts abonamente active today (5.9, C77)', async () => {
    const f = fakePresenceContext(seed());
    expect((await extendPreview(f.store, '2026-11-20')).count).toBe(2);
  });

  it('extends each by the weeks, recomputes validUntil, writes the lines; no athlete lock (5.9, 7.1, 8)', async () => {
    const f = fakePresenceContext(seed());
    expect(await extendSubscriptions(f.ctx, { weeks: 2, key: await keyOf(f) })).toMatchObject({ ok: true, data: { value: { count: 2, weeks: 2 } } });
    expect(f.state.subscriptions.find((s) => s.id === 'b')).toMatchObject({ extendedWeeks: 2, validUntil: '2026-12-04' });
    expect(f.state.subscriptions.find((s) => s.id === 'c')?.extendedWeeks).toBe(0);
    expect(f.group.locks).toEqual(['subscription:a', 'subscription:b']);
    expect(historyOf(f, 'subscription', 'b')).toEqual(['Prelungit cu 2 săptămâni: 20 noi 2026 → 4 dec 2026.']);
    expect(historyOf(f, 'athlete', 'a2')).toEqual(['Abonament prelungit cu 2 săptămâni: expiră pe 4 dec 2026.']);
  });

  it('the same preview sent twice: the second is refused (decided 3, Review Focus)', async () => {
    const f = fakePresenceContext(seed());
    const key = await keyOf(f);
    await extendSubscriptions(f.ctx, { weeks: 1, key });
    expect(await extendSubscriptions(f.ctx, { weeks: 1, key })).toEqual({ ok: false, status: 409, error: 'Abonamentele s-au schimbat. Reîncarcă pagina.' });
  });

  it('weeks outside 1 to 12 or not whole: 400', async () => {
    const f = fakePresenceContext(seed());
    const key = await keyOf(f);
    for (const weeks of [0, 13, 1.5, '2']) expect(await extendSubscriptions(f.ctx, { weeks, key })).toMatchObject({ ok: false, status: 400 });
  });

  it('undo subtracts the weeks; refused after another extension (7.3)', async () => {
    const f = fakePresenceContext(seed());
    const res = await extendSubscriptions(f.ctx, { weeks: 1, key: await keyOf(f) });
    expect(await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) })).toEqual({ ok: true, data: { undone: true } });
    expect(f.state.subscriptions.find((s) => s.id === 'a')).toMatchObject({ extendedWeeks: 0, validUntil: '2026-11-23' });
    const again = await extendSubscriptions(f.ctx, { weeks: 1, key: await keyOf(f) });
    await extendSubscriptions(f.ctx, { weeks: 1, key: await keyOf(f) });
    expect((await undoPresenceAction(f.ctx, { actionId: actionIdOf(again) })).ok).toBe(false);
  });
});
