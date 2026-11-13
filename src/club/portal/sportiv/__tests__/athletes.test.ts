import { describe, expect, it } from 'vitest';
import { forbiddenPathsIn } from '../../forbidden-keys';
import { attendanceRow, lessonRow, paymentRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { inPicker, readAthletes } from '../athletes';
import { SPORTIV_FORBIDDEN_KEYS } from '../views';
import { fakeHandCompetitions } from '../../../skate/hand-store';
import { pickedResults } from '../../../skate/pick';
import { snapshotCache } from '../../../skate/cache';
import { fakeSnapshotStore } from '../../../skate/fake-store';
import type { SkateClient } from '../../../skate/client';
import { A_ANA, A_IOANA, A_MATEI, giveSluglessProfile, sportivCtx } from './sportiv-seed';

const TODAY = '2026-11-20';

describe('inPicker', () => {
  it('an activ athlete is always in', () => {
    expect(inPicker({ status: 'activ' }, false, null, TODAY)).toBe(true);
    expect(inPicker({ status: 'nou' }, false, null, TODAY)).toBe(true);
  });

  it('an inactiv one needs a debt or a presence in the last 12 months', () => {
    expect(inPicker({ status: 'inactiv' }, false, '2025-10-20', TODAY)).toBe(false); // 13 months
    expect(inPicker({ status: 'inactiv' }, false, '2025-12-20', TODAY)).toBe(true); // 11 months
    expect(inPicker({ status: 'inactiv' }, false, '2025-11-20', TODAY)).toBe(true); // exactly 12 months
    expect(inPicker({ status: 'inactiv' }, false, null, TODAY)).toBe(false);
    expect(inPicker({ status: 'inactiv' }, true, '2024-01-01', TODAY)).toBe(true);
    expect(inPicker({ status: 'inactiv' }, true, null, TODAY)).toBe(true);
  });
});

describe('readAthletes', () => {
  it('lists the held athletes by name, with group, section, age and no performance flag without a slug', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    expect(await readAthletes(c)).toEqual({ athletes: [
      { id: A_ANA, name: 'Ana Ionescu', firstName: 'Ana', groupName: 'Intermediari Bronze', age: 9, section: 'school', inPicker: true, performance: false },
      { id: A_MATEI, name: 'Matei Ionescu', firstName: 'Matei', groupName: 'Primii Pași', age: 7, section: 'school', inPicker: true, performance: false },
    ] });
  });

  it('performance without a slug follows the hand-entered competitions: false with none, true with one', async () => {
    const client = { results: async () => ({ ok: true, value: [] }), protocol: async () => ({ ok: false, reason: 'down' }), fieldSize: async () => ({ ok: false, reason: 'down' }), officialUrl: async () => ({ ok: false, reason: 'down' }) } as SkateClient;
    const NOW = new Date('2026-11-20T10:00:00.000Z');
    const flagOf = async (entries: { id: number; name: string; date: string; location: string; participantData: unknown }[]) => {
      const c = sportivCtx('parinte1@example.invalid');
      giveSluglessProfile(c, A_MATEI, 'sp-matei');
      const cache = snapshotCache(fakeSnapshotStore(), () => NOW, () => undefined);
      const withHand = { ...c, results: pickedResults(cache, client, fakeHandCompetitions(entries), () => NOW) };
      return (await readAthletes(withHand)).athletes.map((a) => [a.id, a.performance]);
    };
    expect(await flagOf([])).toEqual([[A_ANA, false], [A_MATEI, false]]);
    expect(await flagOf([{ id: 5, name: 'Cupa', date: '2026-10-20', location: 'Cluj', participantData: [{ documentId: 'sp-matei', placement: 1 }] }])).toEqual([[A_ANA, false], [A_MATEI, true]]);
  });

  it('a performance athlete has a slug and a Club section; only held athletes are listed', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    const { athletes } = await readAthletes(c);
    expect(athletes).toMatchObject([{ id: A_IOANA, groupName: 'Club Performanță', section: 'club', performance: true, age: 19 }]);
  });

  it('age is null without a birth date and the group is null without a membership', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.group.athletes.find((a) => a.id === A_MATEI)!.birthDate = null;
    c.fake.group.memberships.length = 0;
    expect((await readAthletes(c)).athletes).toMatchObject([{ id: A_ANA, groupName: null, section: null }, { id: A_MATEI, age: null, groupName: null, section: null }]);
  });

  it('an inactiv athlete drops out of the picker unless it owes or was present within 12 months, and is listed either way', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.group.athletes.find((a) => a.id === A_MATEI)!.status = 'inactiv';
    expect((await readAthletes(c)).athletes.find((a) => a.id === A_MATEI)?.inPicker).toBe(false);
    c.fake.state.sessions.push(sessionRow({ id: 's-old', groupId: 'g-pp', date: '2026-01-15' }));
    c.fake.state.attendances.push(attendanceRow({ id: 't-old', sessionId: 's-old', athleteId: A_MATEI, uniqueKey: 's-old|m' }));
    expect((await readAthletes(c)).athletes.find((a) => a.id === A_MATEI)?.inPicker).toBe(true);
  });

  it('a held lesson counts as a presence, and an unpaid abonament as a debt', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.group.athletes.find((a) => a.id === A_MATEI)!.status = 'inactiv';
    c.fake.state.lessons.push(lessonRow({ id: 'l-old', athleteId: A_MATEI, date: '2026-06-01', state: 'saved', present: true }));
    expect((await readAthletes(c)).athletes.find((a) => a.id === A_MATEI)?.inPicker).toBe(true);
    c.fake.state.lessons.length = 0;
    expect((await readAthletes(c)).athletes.find((a) => a.id === A_MATEI)?.inPicker).toBe(false);
    c.fake.state.subscriptions.push({ ...c.fake.state.subscriptions[0], id: 'sub-matei', athleteId: A_MATEI, price: 320 });
    expect((await readAthletes(c)).athletes.find((a) => a.id === A_MATEI)?.inPicker).toBe(true);
    c.fake.state.payments.push(paymentRow({ id: 'p-m', athleteId: A_MATEI, amount: 320, purpose: 'abonament', subscriptionId: 'sub-matei' }));
    expect((await readAthletes(c)).athletes.find((a) => a.id === A_MATEI)?.inPicker).toBe(false);
  });

  it('extra columns on the athlete rows do not leave', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    const answer = await readAthletes(c);
    expect(JSON.stringify(answer)).not.toMatch(/Alergie|Părinte Secret|0722000111|example\.invalid|2017-04-02/);
    expect(forbiddenPathsIn(answer, [...SPORTIV_FORBIDDEN_KEYS, 'email', 'phone', 'birthDate', 'contactName'])).toEqual([]);
  });
});
