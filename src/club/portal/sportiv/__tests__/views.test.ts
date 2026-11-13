import { describe, expect, it } from 'vitest';
import { FORBIDDEN_KEYS, forbiddenKeysIn } from '../../coach/views';
import { forbiddenPathsIn } from '../../forbidden-keys';
import type { CalendarItem, HistoryRow, PaymentRow, SportivHome, Ticket } from '../api-types';
import { nullSportivCompetitions, skaterOf } from '../competitions';
import { CALENDAR_NOTE_PATHS, HOME_NOTE_PATHS, SPORTIV_ALLOWED_PATHS, SPORTIV_FORBIDDEN_KEYS, toCalendarItem, toHistoryRow, toHome, toPaymentRow, toTicket } from '../views';
import { A_ANA, A_ELENA, A_IOANA, sportivCtx } from './sportiv-seed';

/** A store row carries every forbidden key, and some more. */
const leaky = Object.fromEntries([...SPORTIV_FORBIDDEN_KEYS, 'price', 'amountDue', 'email', 'birthDate'].map((k) => [k, `secret-${k}`]));
const dirty = <T extends object>(row: T): T => ({ ...leaky, ...row }) as T;

const item: CalendarItem = { date: '2026-11-21', startTime: '11:00', endTime: '11:50', kind: 'grupa', title: 'Intermediari Bronze', location: 'AFI', coaches: ['Virgil'], cancelled: true, note: 'Sală închisă' };

describe('forbiddenPathsIn', () => {
  it('names the dotted path, with * for array items', () => {
    expect(forbiddenPathsIn({ a: { notes: 'x' } }, ['notes'])).toEqual(['a.notes']);
    expect(forbiddenPathsIn({ items: [{ note: 'a' }, { note: 'b' }] }, ['note'])).toEqual(['items.*.note']);
    expect(forbiddenPathsIn([{ note: 'a' }], ['note'])).toEqual(['*.note']);
    expect(forbiddenPathsIn({ fine: { deeper: [1, null, { ok: true }] } }, ['note'])).toEqual([]);
  });

  it('allows a path, so a calendar note passes and a payment note fails', () => {
    const answer = { items: [{ note: 'Sală închisă' }], payments: { rows: [{ note: 'cash' }] } };
    expect(forbiddenPathsIn(answer, SPORTIV_FORBIDDEN_KEYS, SPORTIV_ALLOWED_PATHS)).toEqual(['payments.rows.*.note']);
    expect(forbiddenPathsIn({ items: [{ note: 'x' }] }, SPORTIV_FORBIDDEN_KEYS, SPORTIV_ALLOWED_PATHS)).toEqual([]);
  });

  it('the coach wrapper keeps its behaviour', () => {
    expect(forbiddenKeysIn({ a: [{ price: 1 }, { price: 2 }] })).toEqual(['price']);
    expect(forbiddenKeysIn({ x: { email: 'x' } }, ['email'])).toEqual([]);
    expect(FORBIDDEN_KEYS).toContain('registrations');
  });
});

describe('sportiv views drop every forbidden key', () => {
  const home: SportivHome = {
    athlete: { id: 'a1', name: 'Ana Ionescu', firstName: 'Ana', age: 9, inactive: false },
    level: { groupId: 'g-ib', groupName: 'Intermediari Bronze', sectionName: 'Școala', section: 'school', location: 'AFI' },
    category: null, seasonLabel: '2026-2027', presences: { total: 26, months: [{ month: '2026-10', count: 9, state: 'past' }] }, upcoming: [item],
    abonament: { code: 'A-1', next: 5, slots: 8, validUntil: '2026-11-28' },
    lastCompetition: { available: true, stale: false, updatedAt: '2026-11-20T10:00:00Z', field: 12, row: { resultId: 'r1', eventName: 'Cupa', date: '2026-11-14', location: 'Cluj', category: 'Juniori', categoryShort: 'J', placement: 2, total: 98 } },
    promotion: { from: 'Primii Pași', to: 'Intermediari Bronze' },
  };

  it('toHome carries the contract fields and nothing else', () => {
    const view = toHome(dirty({
      ...home, athlete: dirty(home.athlete), level: dirty(home.level!), upcoming: [dirty(item)], abonament: dirty(home.abonament!), promotion: dirty(home.promotion!),
      presences: { total: 26, months: [dirty(home.presences.months[0])] },
      lastCompetition: { ...home.lastCompetition!, row: dirty((home.lastCompetition as { row: object }).row) } as SportivHome['lastCompetition'],
    }));
    expect(view).toEqual(home);
    expect(forbiddenPathsIn(view, [...SPORTIV_FORBIDDEN_KEYS, 'price', 'email', 'birthDate'], HOME_NOTE_PATHS)).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('secret-');
  });

  it('a history row, a calendar item, a payment and a ticket are built by name', () => {
    const row: HistoryRow = { date: '2026-11-14', startTime: '11:00', kind: 'Grup', groupName: 'Intermediari Bronze', coaches: ['Virgil'] };
    const pay: PaymentRow = { what: 'Abonament 8 ședințe', paidOn: '2026-11-01', method: 'card', amount: 320 };
    const ticket: Ticket = { code: 'A-1', itemName: 'Abonament 8 ședințe', startsOn: '2026-11-01', validUntil: '2026-11-28', slots: 8, used: ['2026-11-07'], left: 7 };
    expect(toHistoryRow(dirty(row))).toEqual(row);
    expect(toCalendarItem(dirty(item))).toEqual(item);
    expect(toPaymentRow(dirty(pay))).toEqual(pay);
    expect(toTicket(dirty(ticket))).toEqual(ticket);
    for (const view of [toHistoryRow(dirty(row)), toPaymentRow(dirty(pay)), toTicket(dirty(ticket))]) {
      expect(forbiddenPathsIn(view, SPORTIV_FORBIDDEN_KEYS)).toEqual([]);
    }
    expect(forbiddenPathsIn({ items: [toCalendarItem(dirty(item))] }, SPORTIV_FORBIDDEN_KEYS, CALENDAR_NOTE_PATHS)).toEqual([]);
  });

  it('a calendar item keeps its note only when cancelled', () => {
    expect(toCalendarItem({ ...item, cancelled: false, note: 'Sală închisă' }).note).toBeNull();
    expect(toCalendarItem({ ...item, cancelled: true, note: 'Sală închisă' }).note).toBe('Sală închisă');
    expect(SPORTIV_ALLOWED_PATHS).toEqual([...CALENDAR_NOTE_PATHS, ...HOME_NOTE_PATHS]);
  });
});

describe('competition source and skaterOf', () => {
  it('the null source resolves null everywhere', async () => {
    const skater = { athleteId: 'a1', name: 'Ana', profileId: 'p1', slug: 'ana' };
    expect(await nullSportivCompetitions.last(skater)).toBeNull();
    expect(await nullSportivCompetitions.count(skater)).toBeNull();
  });

  it('an athlete is a skater when it has a profile, the slug may be absent', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    expect(await skaterOf(c, A_ANA)).toBeNull();
    expect(await skaterOf(c, 'a-unknown')).toBeNull();
    expect(await skaterOf(c, A_IOANA)).toMatchObject({ athleteId: A_IOANA, name: 'Ioana Marin', slug: 'ioana-marin-test' });
    expect(await skaterOf(c, A_ELENA)).toBeNull();
  });

  it('an anonymized athlete is no skater, even with a slug', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    c.clubFake.state.athletes.find((a) => a.id === A_IOANA)!.status = 'anonimizat';
    expect(await skaterOf(c, A_IOANA)).toBeNull();
  });
});
