import { describe, expect, it } from 'vitest';
import { forbiddenPathsIn } from '../../forbidden-keys';
import { attendanceRow, lessonRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { member } from '../../../groups/__tests__/fake-group-store';
import type { GroupRecord } from '../../../groups/types';
import type { MembershipRow, SeasonRow } from '../../../athletes/store';
import type { SportivCompetitionSource } from '../competitions';
import { earlierLevels, nextLevel, readPath } from '../path';
import { SPORTIV_ALLOWED_PATHS, SPORTIV_FORBIDDEN_KEYS } from '../views';
import { A_ANA, A_IOANA, A_MATEI, sportivCtx, type SportivSeed } from './sportiv-seed';

const grp = (id: string, sectionId: string, order: number | null, active = true): GroupRecord =>
  ({ id, name: id, sectionId, order, active, priceListId: null, coachIds: [], programPublic: true });
const SEASONS: SeasonRow[] = [
  { id: 's25', label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31', isCurrent: false },
  { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true },
];
const ms = (over: Partial<MembershipRow> & { id: string; groupId: string }): MembershipRow => member({ athleteId: 'a', ...over });

describe('nextLevel', () => {
  const groups = [grp('g1', 'afi', 1), grp('g2', 'afi', 2, false), grp('g3', 'afi', 3), grp('x2', 'club', 2), grp('g4', 'afi', 4)];
  it('is the next higher order of the same section, inactive groups and other sections skipped', () => {
    expect(nextLevel(groups[0], groups)?.id).toBe('g3');
  });
  it('is null on the last level', () => {
    expect(nextLevel(groups[4], groups)).toBeNull();
    expect(nextLevel(grp('g0', 'afi', null), groups)).toBeNull();
  });
});

describe('earlierLevels', () => {
  const groups = [grp('g-a', 'afi', 1), grp('g-b', 'afi', 2)];
  it('merges two consecutive memberships of one group in one season, newest first, YYYY-MM', () => {
    const rows = earlierLevels([
      ms({ id: '1', groupId: 'g-a', seasonId: 's25', from: '2025-10-01', to: '2025-12-31' }),
      ms({ id: '2', groupId: 'g-a', seasonId: 's25', from: '2026-01-01', to: '2026-03-14' }),
      ms({ id: '3', groupId: 'g-b', seasonId: 's25', from: '2026-03-15', to: '2026-05-31' }),
    ], SEASONS, groups, null);
    expect(rows).toEqual([{ groupName: 'g-b', from: '2026-03', to: '2026-05' }, { groupName: 'g-a', from: '2025-10', to: '2026-03' }]);
  });
  it('leaves out the current run and uses the season bounds for an open earlier one', () => {
    const rows = earlierLevels([
      ms({ id: '1', groupId: 'g-a', seasonId: 's25', from: null, to: null }),
      ms({ id: '2', groupId: 'g-b', seasonId: 's26', from: '2026-10-01', to: null }),
    ], SEASONS, groups, 'g-b');
    expect(rows).toEqual([{ groupName: 'g-a', from: '2025-10', to: '2026-05' }]);
  });
  it('keeps a group seen in an earlier season and leaves out a move not yet in effect', () => {
    const rows = earlierLevels([
      ms({ id: '1', groupId: 'g-b', seasonId: 's25', from: '2025-10-01', to: '2026-05-31' }),
      ms({ id: '2', groupId: 'g-a', seasonId: 's26', from: '2026-10-01', to: '2026-12-04' }),
      ms({ id: '3', groupId: 'g-b', seasonId: 's26', from: '2026-12-05', to: null }),
    ], SEASONS, groups, 'g-a', '2026-11-20');
    expect(rows).toEqual([{ groupName: 'g-b', from: '2025-10', to: '2026-05' }]);
  });
});

function withSessions(c: SportivSeed, n: number, groupId = 'g-pp'): void {
  for (let i = 0; i < n; i++) {
    const date = `2026-10-${String((i % 28) + 1).padStart(2, '0')}`;
    const id = `s-${groupId}-${i}`;
    c.fake.state.sessions.push(sessionRow({ id, groupId, date }));
    c.fake.state.attendances.push(attendanceRow({ id: `t-${id}`, sessionId: id, athleteId: A_ANA, uniqueKey: `${id}|ana`, grup: true }));
  }
}

describe('readPath', () => {
  it('now: the main group today with since, location, program and coaches as the coach group page reads them', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.group.sections.find((s) => s.id === 'afi')!.locationName = 'AFI Cotroceni';
    const path = await readPath(c, A_ANA);
    expect(path.now).toEqual({ groupName: 'Intermediari Bronze', since: '2026-11', location: 'AFI Cotroceni', program: 'Sâ și Du, 11:00, cu Virgil Pascu' });
    expect(path.next).toEqual({ groupName: 'Intermediari Silver' });
    expect(path.before).toEqual([{ groupName: 'Primii Pași', from: '2026-10', to: '2026-11' }]);
    expect(path.parcurs.membru[0]).toMatchObject({ pin: 'membru-1', earnedOn: null });
  });

  it('a group without a program has no program text', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.group.events.length = 0;
    expect((await readPath(c, A_ANA)).now?.program).toBeNull();
  });

  it('an athlete moved from Începători to Intermediari Bronze in January shows the old group with its dates', async () => {
    const c = sportivCtx('parinte1@example.invalid', '2027-02-10');
    const old = c.fake.group.memberships.find((m) => m.id === 'gm-ana-old')!;
    old.groupId = 'g-pp'; old.from = '2026-10-01'; old.to = '2027-01-09';
    const now = c.fake.group.memberships.find((m) => m.id === 'gm-ana')!;
    now.from = '2027-01-10';
    const path = await readPath(c, A_ANA);
    expect(path.before).toEqual([{ groupName: 'Primii Pași', from: '2026-10', to: '2027-01' }]);
    expect(path.now).toMatchObject({ groupName: 'Intermediari Bronze', since: '2027-01' });
  });

  it('a dated move in the future shows the old group now and nothing about the new one', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    const current = c.fake.group.memberships.find((m) => m.id === 'gm-ana')!;
    current.to = '2026-12-04';
    c.fake.group.memberships.push({ ...current, id: 'gm-ana-next', groupId: 'g-is', from: '2026-12-05', to: null });
    const path = await readPath(c, A_ANA);
    expect(path.now?.groupName).toBe('Intermediari Bronze');
    expect(path.before.map((b) => b.groupName)).toEqual(['Primii Pași']);
  });

  it('an athlete in the last level has no next', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    const path = await readPath(c, A_IOANA);
    expect(path.now?.groupName).toBe('Club Performanță');
    expect(path.next).toBeNull();
  });

  it('pins count all time: the new season has no presences on 1 September but the counted pins keep counting', async () => {
    const c = sportivCtx('parinte1@example.invalid', '2027-09-01');
    withSessions(c, 25);
    c.fake.group.seasons.find((s) => s.id === 's26')!.isCurrent = false;
    c.fake.group.seasons.find((s) => s.id === 's27')!.isCurrent = true;
    const path = await readPath(c, A_ANA);
    expect(path.now).toBeNull();
    expect(path.parcurs.antrenamente.find((p) => p.pin === 'antrenamente-25')?.earnedOn).not.toBeNull();
    expect(path.parcurs.antrenamente.find((p) => p.pin === 'antrenamente-50')?.earnedOn).toBeNull();
  });

  it('counts present lessons and ignores absent ones', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.state.lessons.push(lessonRow({ id: 'l1', athleteId: A_ANA, date: '2026-11-05', state: 'saved', present: true }));
    c.fake.state.lessons.push(lessonRow({ id: 'l2', athleteId: A_ANA, date: '2026-11-06', state: 'saved', present: false }));
    const first = (id: string) => readPath(c, id).then((p) => p.parcurs.antrenamente.find((x) => x.pin === 'prima-lectie'));
    expect(await first(A_ANA)).toMatchObject({ earnedOn: '2026-11-05' });
    expect(await first(A_MATEI)).toMatchObject({ earnedOn: null });
  });

  it('a performance athlete with the null source has no Concursuri pins; a real source counts events', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    expect((await readPath(c, A_IOANA)).parcurs.concursuri.every((p) => p.earnedOn === null)).toBe(true);
    const dates = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
    const source: SportivCompetitionSource = {
      last: async () => null,
      results: async () => dates.map((date, i) => ({ date, placement: i === 0 ? 1 : 5, eventId: `e${i}` })),
    };
    const got = await readPath({ ...c, competitions: source }, A_IOANA);
    expect(got.parcurs.concursuri.filter((p) => p.earnedOn !== null).map((p) => p.pin)).toEqual(['concursuri-1', 'concursuri-2', 'concursuri-5']);
    expect(got.parcurs.insigne.find((p) => p.pin === 'locul-1')).toMatchObject({ count: 1, earnedOn: '2026-11-01' });
    const down: SportivCompetitionSource = { ...source, results: async () => { throw new Error('down'); } };
    expect((await readPath({ ...c, competitions: down }, A_IOANA)).parcurs.concursuri.every((p) => p.earnedOn === null)).toBe(true);
  });

  it('leaks nothing a sportiv may not see', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    withSessions(c, 30);
    const answer = await readPath(c, A_ANA);
    expect(forbiddenPathsIn(answer, [...SPORTIV_FORBIDDEN_KEYS, 'email', 'phone', 'birthDate', 'contactName'], SPORTIV_ALLOWED_PATHS)).toEqual([]);
  });
});
