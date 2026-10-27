import { describe, expect, it } from 'vitest';
import { planRows } from '../attendance/save-plan';
import { readSaveBody } from '../attendance/save-plan';
import { attendanceRow, P_LISTS, subscriptionRow } from './fake-store';

const list = (id: string) => P_LISTS.find((l) => l.id === id) ?? null;
const base = { sessionId: 's1', listed: ['a1', 'a2'], date: '2026-11-14', audience: () => 'nonMember' as const, used: new Map<string, number>() };

describe('planRows', () => {
  it('Școala: slot when valid, else Fără abonament; Uscat ignored (4.10, decided 4)', () => {
    const p = planRows({
      ...base, kind: 'school', list: list('pl-std'), existing: [], subs: [subscriptionRow({ id: 'sub-a1', athleteId: 'a1', startsOn: '2026-11-01', validUntil: '2026-11-28' })],
      ticks: [{ athleteId: 'a1', grup: true, uscat: true }, { athleteId: 'a2', grup: true, uscat: false }, { athleteId: 'a3', grup: false, uscat: true }],
    });
    expect(p.creates.map((c) => [c.athleteId, c.billing, c.subscriptionId, c.uscat, c.uniqueKey, c.visitor])).toEqual([
      ['a1', 'slot', 'sub-a1', false, 's1|a1', false], ['a2', 'fara_abonament', null, false, 's1|a2', false]]);
  });

  it('the last slot is used once (4.8)', () => {
    const sub = subscriptionRow({ id: 'sub-a1', athleteId: 'a1', slots: 8, startsOn: '2026-11-01', validUntil: '2026-11-28' });
    const p = planRows({ ...base, kind: 'school', list: list('pl-std'), existing: [], subs: [sub], used: new Map([['sub-a1', 8]]), ticks: [{ athleteId: 'a1', grup: true, uscat: false }] });
    expect(p.creates[0].billing).toBe('fara_abonament');
  });

  it('two rows never take one last slot', () => {
    const sub = subscriptionRow({ id: 'sub-a1', athleteId: 'a1', slots: 1, startsOn: '2026-11-01', validUntil: '2026-11-28' });
    const p = planRows({ ...base, kind: 'school', list: list('pl-std'), existing: [], subs: [sub, { ...sub, id: 'sub-b' }], ticks: [{ athleteId: 'a1', grup: true, uscat: false }] });
    expect(p.creates).toHaveLength(1);
    expect(p.creates[0].subscriptionId).toBe('sub-a1');
  });

  it('Club: priced on create, frozen when unchanged, repriced when ticks change (4.12, C29)', () => {
    const kept = attendanceRow({
      id: 't5', sessionId: 's1', athleteId: 'a1', grup: true, uscat: false, billing: 'club', amount: 50,
      charges: [{ type: 'grup', itemName: 'Ședință grup', price: 50, included: false }],
    });
    const changed = attendanceRow({ id: 't6', sessionId: 's1', athleteId: 'a2', grup: true, uscat: false, billing: 'club', amount: 50 });
    const p = planRows({
      ...base, kind: 'club', list: list('pl-club'), existing: [kept, changed], subs: [],
      ticks: [{ athleteId: 'a1', grup: true, uscat: false }, { athleteId: 'a2', grup: true, uscat: true }],
    });
    expect(p.updates).toEqual([{ id: 't6', data: expect.objectContaining({ uscat: true, billing: 'club', amount: 75 }) }]);
    expect([p.creates, p.deletes, p.uscatTicked]).toEqual([[], [], ['a2']]);
  });

  it('untick deletes the row and frees its slot; a re-save keeps a slot of an expired abonament (C25)', () => {
    const row = attendanceRow({ id: 't1', sessionId: 's1', athleteId: 'a1', subscriptionId: 'sub-old', billing: 'slot' });
    const kept = planRows({ ...base, kind: 'school', list: list('pl-std'), existing: [row], subs: [], ticks: [{ athleteId: 'a1', grup: true, uscat: false }] });
    expect([kept.creates, kept.updates, kept.deletes]).toEqual([[], [], []]);
    const off = planRows({ ...base, kind: 'school', list: list('pl-std'), existing: [row], subs: [], ticks: [] });
    expect([off.deletes, off.removed]).toEqual([['t1'], ['a1']]);
  });

  it("a visitor in a Club group pays the visited group's prices (4.7, p5 Q16)", () => {
    const p = planRows({ ...base, kind: 'club', list: list('pl-club'), existing: [], subs: [], audience: () => 'member', ticks: [{ athleteId: 'a7', grup: true, uscat: false }] });
    expect(p.creates[0]).toMatchObject({ visitor: true, billing: 'club', amount: 40, audience: 'member' });
    expect(p.newVisitors).toEqual(['a7']);
  });

  it('a group without a price list records presence, bills nothing (4.12)', () => {
    expect(planRows({ ...base, kind: 'club', list: null, existing: [], subs: [], ticks: [{ athleteId: 'a1', grup: true, uscat: true }] }).creates[0])
      .toMatchObject({ billing: 'fara_pret', charges: [], amount: 0, grup: true, uscat: true });
  });
});

describe('readSaveBody', () => {
  const tick = { athleteId: 'a1', grup: true, uscat: false };
  it('reads exactly one target and defaults the lists', () => {
    expect(readSaveBody({ id: 's1', coachIds: ['c'], ticks: [tick] })).toEqual({ id: 's1', coachIds: ['c'], ticks: [tick], reactivate: [], keepInactive: [] });
    expect(readSaveBody({ id: 's1', occurrence: 'k', coachIds: [], ticks: [] })).toBeNull();
    expect(readSaveBody({ coachIds: [], ticks: [] })).toBeNull();
    expect(readSaveBody({ id: 's1', coachIds: [], ticks: [{ athleteId: 'a1', grup: 'da' }] })).toBeNull();
    expect(readSaveBody({ id: 's1', coachIds: [], ticks: [], reactivate: [1] })).toBeNull();
    expect(readSaveBody({ added: { groupId: 'g', date: '2026-11-17', startTime: '11:00', durationMin: 3 }, coachIds: [], ticks: [] })).toBeNull();
  });
});
