import { describe, expect, it } from 'vitest';
import { G_SECTIONS } from '../../groups/__tests__/fake-group-store';
import { attendanceRow, P_GROUPS, P_LISTS, subscriptionRow } from './fake-store';
import type { AttendanceRow } from '../types';
import {
  abonamentCellText, athleteListIdsToday, barOf, checkCover, coverCandidates, currentSubscription, defaultCover, extendableIds, extendedValues, extendKey,
  listsForAthlete, offeredSubscriptionItems, schoolListIds, startText, subscriptionWrite,
} from '../subscriptions/rules';
import { SUBSCRIPTION_COPY } from '../copy';

const list = (id: string) => P_LISTS.find((l) => l.id === id)!;
const schoolIds = schoolListIds(P_LISTS, G_SECTIONS);
const row = (over: Parameters<typeof attendanceRow>[0] & { sessionDate: string; groupId: string }): AttendanceRow => ({ ...attendanceRow(over), sessionDate: over.sessionDate, groupId: over.groupId });

describe('abonament rules', () => {
  it('school lists only; the main school group list, else every school list (4.9, C22)', () => {
    expect([...schoolIds].sort()).toEqual(['pl-gold', 'pl-std']);
    expect(listsForAthlete(P_LISTS, schoolIds, 'pl-std').map((l) => l.id)).toEqual(['pl-std']);
    expect(listsForAthlete(P_LISTS, schoolIds, null).map((l) => l.id).sort()).toEqual(['pl-gold', 'pl-std']);
  });
  it('offers subscription items at the audience price only (4.9)', () => {
    expect(offeredSubscriptionItems(list('pl-std'), 'member')).toEqual([
      { itemKey: 'Abonament 8 ședințe', itemName: 'Abonament 8 ședințe', slots: 8, price: 320, priceListId: 'pl-std', listName: 'Standard' },
      { itemKey: 'Abonament 6 ședințe', itemName: 'Abonament 6 ședințe', slots: 6, price: 260, priceListId: 'pl-std', listName: 'Standard' }]);
    const noMember = { ...list('pl-std'), items: list('pl-std').items.map((i) => ({ ...i, memberPrice: null })) };
    expect(offeredSubscriptionItems(noMember, 'member')).toEqual([]);
  });
  it('coverage: own "Fără abonament" rows in groups of the list, oldest first, capped at the slots (4.9, C23)', () => {
    const rows = [row({ id: 't3', sessionDate: '2026-10-20', groupId: 'g-ib', billing: 'fara_abonament' }),
      row({ id: 't1', sessionDate: '2026-10-13', groupId: 'g-ib', billing: 'fara_abonament' }),
      row({ id: 't2', sessionDate: '2026-10-06', groupId: 'g-gold', billing: 'fara_abonament' }),
      row({ id: 't4', sessionDate: '2026-10-01', groupId: 'g-ib', billing: 'slot', subscriptionId: 'x' })];
    const c = coverCandidates(rows, P_GROUPS);
    expect(c.map((r) => r.attendanceId)).toEqual(['t2', 't1', 't3']);
    expect(defaultCover(c, 'pl-std', 1)).toEqual(['t1']);
    expect(checkCover(['t1', 't3'], c, 'pl-std', 2)).toBe(true);
    expect(checkCover(['t1', 't3'], c, 'pl-std', 1)).toBe(false);
    expect(checkCover(['t2'], c, 'pl-std', 8)).toBe(false);
    expect(checkCover(['t4'], c, 'pl-std', 8)).toBe(false);
    expect(checkCover(['t1', 't1'], c, 'pl-std', 8)).toBe(false);
  });
  it('freezes item, price, audience, slots; validUntil = start + 27 days (3.4, p5 Q36)', () => {
    const item = offeredSubscriptionItems(list('pl-std'), 'nonMember')[0];
    expect(subscriptionWrite({ athleteId: 'a1', seasonId: 's26', item, audience: 'nonMember', startsOn: '2026-10-27', actor: 'Ana', now: '2026-10-27T09:00:00.000Z' }))
      .toEqual({ athleteId: 'a1', seasonId: 's26', priceListId: 'pl-std', validIn: [], itemName: 'Abonament 8 ședințe', price: 360, audience: 'nonMember', slots: 8,
        startsOn: '2026-10-27', validUntil: '2026-11-23', extendedWeeks: 0, cancelled: false, cancelledAt: null, cancelledBy: null, purchasedAt: '2026-10-27T09:00:00.000Z', recordedBy: 'Ana' });
  });
  it('extends only abonamente active today on school lists (5.9, C77)', () => {
    const last = subscriptionRow({ id: 'last', validUntil: '2026-11-20' });
    const gone = subscriptionRow({ id: 'gone', validUntil: '2026-11-19' });
    const full = subscriptionRow({ id: 'full', slots: 6 });
    const off = subscriptionRow({ id: 'off', cancelled: true });
    const club = subscriptionRow({ id: 'club', priceListId: 'pl-club', validUntil: '2026-11-30' });
    const used = new Map([['full', 6]]);
    expect(extendableIds([last, gone, full, off, club], used, schoolIds, '2026-11-20')).toEqual(['last']);
    expect(extendedValues({ ...last, startsOn: '2026-10-24', extendedWeeks: 0 }, 2)).toEqual({ extendedWeeks: 2, validUntil: '2026-12-04' });
    expect(extendedValues({ ...last, startsOn: '2026-10-24', extendedWeeks: 2 }, 1)).toEqual({ extendedWeeks: 3, validUntil: '2026-12-11' });
    expect(extendKey([last])).not.toBe(extendKey([{ ...last, extendedWeeks: 1 }]));
    expect(extendKey([last, gone])).toBe(extendKey([gone, last]));
  });
  it('bar, current abonament and Sportivi cell (5.7, 5.12, 5.13, decided 9)', () => {
    const a = subscriptionRow({ id: 'a', validUntil: '2026-11-23' });
    const used = new Map([['a', 5]]);
    expect(barOf(a, used)).toEqual({ subscriptionId: 'a', itemName: 'Abonament 8 ședințe', slots: 8, used: 5, validUntil: '2026-11-23' });
    expect(currentSubscription([a], used, ['pl-std'], '2026-11-20')?.id).toBe('a');
    expect(currentSubscription([a], used, ['pl-gold'], '2026-11-20')).toBeNull();
    expect(currentSubscription([a], used, [], '2026-11-20')?.id).toBe('a');
    expect(abonamentCellText(barOf(a, used))).toBe('5/8, 23 noi 2026');
    expect(startText('2026-10-27')).toBe('27 oct');
  });
  it('the lists an athlete has today: current school memberships, main first', () => {
    const m = (id: string, groupId: string, isMain: boolean, to: string | null = null) => ({ id, athleteId: 'a1', groupId, seasonId: 's26', isMain, from: null, to });
    expect(athleteListIdsToday([m('1', 'g-gold', false), m('2', 'g-ib', true), m('3', 'g-av', false), m('4', 'g-gold', false, '2026-11-01')], P_GROUPS, schoolIds, 's26', 'a1'))
      .toEqual(['pl-std', 'pl-gold']);
    expect(athleteListIdsToday([m('1', 'g-ib', true)], P_GROUPS, schoolIds, null, 'a1')).toEqual([]);
  });
  it('copy (5.8, 5.9, 5.12)', () => {
    const c = SUBSCRIPTION_COPY;
    expect(c.extendText(14, 2)).toBe('Se prelungesc 14 abonamente active cu 2 săptămâni. Noua dată de expirare se calculează pentru fiecare.');
    expect(c.extendText(1, 1)).toBe('Se prelungesc 1 abonament activ cu 1 săptămână. Noua dată de expirare se calculează pentru fiecare.');
    expect(c.extendText(20, 1)).toContain('20 de abonamente active');
    expect([c.extendButton(14), c.extendButton(1)]).toEqual(['Prelungește 14 abonamente', 'Prelungește 1 abonament']);
    expect([c.extended(14, 2), c.extended(1, 1)]).toEqual(['14 abonamente prelungite cu 2 săptămâni.', '1 abonament prelungit cu 1 săptămână.']);
    expect([c.barTitle('Abonament 8 ședințe', 8), c.barTitle('Abonament 8 ședințe Gold', 8)]).toEqual(['Abonament Școala de patinaj, 8 ședințe', 'Abonament 8 ședințe Gold']);
    expect([c.usedText(5), c.usedText(1), c.leftText(3), c.leftText(1)]).toEqual(['5 folosite', '1 folosită', '3 rămase', '1 rămasă']);
    expect(c.expiresOn('2026-11-23')).toBe('Expiră pe 23 noi 2026');
    expect(c.coverRow('2026-10-20', 'Intermediari Bronze')).toBe('Mar 20 oct, Intermediari Bronze');
    expect(c.itemOption('Abonament 8 ședințe', 'member')).toBe('Abonament 8 ședințe, preț membru');
    expect(c.noItems('Standard')).toBe('Lista Standard nu are abonamente pentru acest sportiv.');
  });
});
