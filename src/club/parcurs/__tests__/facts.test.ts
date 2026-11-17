import { describe, expect, it } from 'vitest';
import { attendanceRow, lessonRow, sessionRow } from '../../presence/__tests__/fake-store';
import { A_ANA, A_IOANA, A_MATEI, sportivCtx, type SportivSeed } from '../../portal/sportiv/__tests__/sportiv-seed';
import { countedFacts, type FactsDeps } from '../facts';

const none: FactsDeps['results'] = async () => null;
const depsOf = (c: SportivSeed, results: FactsDeps['results'] = none): FactsDeps => ({ presence: c.presence.store, results });

/** `n` saved sessions of Intermediari Bronze in December 2026; Ana is present at the first `present`. */
function december(c: SportivSeed, n: number, present: number): void {
  for (let i = 0; i < n; i++) {
    const id = `dec-${i}`;
    c.fake.state.sessions.push(sessionRow({ id, groupId: 'g-ib', date: `2026-12-${String(i + 5).padStart(2, '0')}` }));
    if (i < present) c.fake.state.attendances.push(attendanceRow({ id: `t-${id}`, sessionId: id, athleteId: A_ANA, uniqueKey: `${id}|ana`, grup: true }));
  }
}
const ana = (c: SportivSeed, today = '2027-01-10') => countedFacts(depsOf(c), A_ANA, today);

describe('countedFacts presence', () => {
  it('counts group and uscat attendances and saved present lessons, nothing else', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.state.sessions.push(sessionRow({ id: 's-a', groupId: 'g-ib', date: '2026-11-21' }), sessionRow({ id: 's-b', groupId: 'g-ib', date: '2026-11-22' }), sessionRow({ id: 's-c', groupId: 'g-ib', date: '2026-11-23' }));
    c.fake.state.attendances.push(
      attendanceRow({ id: 't-a', sessionId: 's-a', athleteId: A_ANA, uniqueKey: 'a', grup: true }),
      attendanceRow({ id: 't-b', sessionId: 's-b', athleteId: A_ANA, uniqueKey: 'b', grup: false, uscat: true }),
      attendanceRow({ id: 't-c', sessionId: 's-c', athleteId: A_ANA, uniqueKey: 'c', grup: false, uscat: false, visitor: true }),
    );
    c.fake.state.lessons.push(
      lessonRow({ id: 'l1', athleteId: A_ANA, date: '2026-11-05', state: 'saved', present: true }),
      lessonRow({ id: 'l2', athleteId: A_ANA, date: '2026-11-06', state: 'saved', present: false }),
      lessonRow({ id: 'l3', athleteId: A_ANA, date: '2026-11-07', state: 'planned', present: true }),
    );
    expect([...(await ana(c)).presenceDates].sort()).toEqual(['2026-11-05', '2026-11-21', '2026-11-22']);
  });
});

describe('countedFacts membership and results', () => {
  it('first membership start is the earliest from, a cancelled row (to before from) ignored', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    expect((await ana(c)).firstMembershipStart).toBe('2026-10-01');
    c.fake.group.memberships.push({ ...c.fake.group.memberships[0], id: 'gm-cancelled', from: '2026-09-01', to: '2026-08-01' });
    expect((await ana(c)).firstMembershipStart).toBe('2026-10-01');
  });

  it('is null without a membership start', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.group.memberships.length = 0;
    expect((await ana(c)).firstMembershipStart).toBeNull();
  });

  it('passes the results through, and null stays null (also when the source throws)', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    const rows = [{ date: '2026-11-01', placement: 1, eventId: '7' }];
    expect((await countedFacts(depsOf(c, async () => rows), A_IOANA, '2026-11-20')).results).toEqual([{ date: '2026-11-01', placement: 1 }]);
    expect((await countedFacts(depsOf(c), A_IOANA, '2026-11-20')).results).toBeNull();
    const twice = [{ date: '2026-11-03', placement: 4, eventId: '7' }, { date: '2026-11-02', placement: 2, eventId: '7' }, { date: '2026-11-09', placement: null, eventId: '8' }];
    expect((await countedFacts(depsOf(c, async () => twice), A_IOANA, '2026-11-20')).results)
      .toEqual([{ date: '2026-11-02', placement: 2 }, { date: '2026-11-09', placement: null }]);
    expect((await countedFacts(depsOf(c, async () => { throw new Error('down'); }), A_IOANA, '2026-11-20')).results).toBeNull();
  });
});

describe('countedFacts perfect months', () => {
  it('a finished month with 4 sessions all attended counts', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    december(c, 4, 4);
    expect((await ana(c)).perfectMonths).toEqual(['2026-12']);
  });
  it('3 sessions do not count', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    december(c, 3, 3);
    expect((await ana(c)).perfectMonths).toEqual([]);
  });
  it('one absence does not count', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    december(c, 4, 3);
    expect((await ana(c)).perfectMonths).toEqual([]);
  });
  it('joining on the 5th does not count', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    december(c, 4, 4);
    c.fake.group.memberships.find((m) => m.id === 'gm-ana')!.from = '2026-12-05';
    expect((await ana(c)).perfectMonths).toEqual([]);
  });
  it('the current month does not count', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    december(c, 4, 4);
    expect((await ana(c, '2026-12-28')).perfectMonths).toEqual([]);
  });
  it('a month before the Parcurs start does not count', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    for (let i = 0; i < 4; i++) {
      c.fake.state.sessions.push(sessionRow({ id: `nov-${i}`, groupId: 'g-ib', date: `2026-11-${i + 20}` }));
      c.fake.state.attendances.push(attendanceRow({ id: `tn-${i}`, sessionId: `nov-${i}`, athleteId: A_ANA, uniqueKey: `n${i}`, grup: true }));
    }
    expect((await ana(c)).perfectMonths).toEqual([]);
  });
  it('asks for the sessions of each month up to its real last day', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    const asked: string[] = [];
    const presence = { ...c.presence.store, sessions: async (q: Parameters<typeof c.presence.store.sessions>[0]) => { asked.push(q.to ?? ''); return c.presence.store.sessions(q); } };
    await countedFacts({ presence, results: none }, A_ANA, '2027-06-10');
    expect(asked).toEqual(expect.arrayContaining(['2026-12-31', '2027-02-28', '2027-04-30']));
    for (const to of asked) expect(new Date(`${to}T00:00:00Z`).toISOString().slice(0, 10)).toBe(to);
    expect(asked).toContain('2027-02-28');
  });
  it('an athlete in another group is not credited with that group sessions', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    december(c, 4, 4);
    expect((await countedFacts(depsOf(c), A_MATEI, '2027-01-10')).perfectMonths).toEqual([]);
  });
});
