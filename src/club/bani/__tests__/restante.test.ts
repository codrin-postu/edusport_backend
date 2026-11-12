import { describe, expect, it } from 'vitest';
import type { ClubDueRow, DuePage, SchoolDueRow } from '../../presence/money-api';
import { restanteBlocks, restanteGroups } from '../restante';

const school = (o: Partial<SchoolDueRow>): SchoolDueRow => ({
  subscriptionId: 's1', athleteId: 'a1', itemName: 'Abonament', startsOn: '2026-10-01', price: 0, paid: 0, left: 0, athleteName: 'Ana Ionescu', groupName: 'Incepatori', ...o,
});
const club = (o: Partial<ClubDueRow>): ClubDueRow => ({
  athleteId: 'a2', athleteName: 'David Stan', groupNames: 'Avansati', grup: 0, uscat: 0, lessons: 0, due: 0, paid: 0, left: 0, ...o,
});
const page = (month: string, o: Partial<DuePage> = {}): DuePage => ({
  month, groupsWithoutList: 0,
  school: [school({ subscriptionId: 's1', left: 100 }), school({ subscriptionId: 's2', left: 300 })],
  club: [club({ athleteId: 'c1', left: 40 }), club({ athleteId: 'c2', left: 60 })],
  ...o,
});

describe('Restante blocks', () => {
  it("section 'club' returns only the club block", () => {
    const blocks = restanteBlocks(page('2026-10'), 'club');
    expect(blocks.map((b) => b.key)).toEqual(['club']);
  });
  it("section 'toate' lists scoala then club", () => {
    expect(restanteBlocks(page('2026-10'), 'toate').map((b) => b.key)).toEqual(['scoala', 'club']);
  });
  it("total equals the sum of rows' ramas", () => {
    const [s, c] = restanteBlocks(page('2026-10'), 'toate');
    expect(s.total).toBe(400);
    expect(c.total).toBe(100);
  });
  it('rows are sorted by ramas, largest first', () => {
    const [s] = restanteBlocks(page('2026-10'), 'scoala');
    expect(s.rows.map((r) => r.left)).toEqual([300, 100]);
  });
  it('an advance counts as 0 in the total', () => {
    const [s] = restanteBlocks(page('2026-10', { school: [school({ left: 50 }), school({ subscriptionId: 's9', left: -20 })] }), 'scoala');
    expect(s.total).toBe(50);
  });
  it('school block ignores month', () => {
    const a = restanteBlocks(page('2026-10'), 'scoala');
    const b = restanteBlocks(page('2026-09', { club: [] }), 'scoala');
    expect(b).toEqual(a);
  });
  it('a block with no rows is left out', () => {
    expect(restanteBlocks(page('2026-10', { club: [] }), 'toate').map((b) => b.key)).toEqual(['scoala']);
  });
  it('a group keeps only its rows, in both blocks', () => {
    const p = page('2026-10', {
      school: [school({ groupName: 'A', left: 10 }), school({ subscriptionId: 's2', groupName: 'B', left: 20 })],
      club: [club({ groupNames: 'A, B', left: 5 }), club({ athleteId: 'c9', groupNames: 'B', left: 7 })],
    });
    const [s, c] = restanteBlocks(p, 'toate', 'A');
    expect([s.rows.length, s.total, c.rows.length, c.total]).toEqual([1, 10, 1, 5]);
  });
  it('group options are the distinct names of both blocks, sorted', () => {
    const p = page('2026-10', { school: [school({ groupName: 'B' }), school({ groupName: null })], club: [club({ groupNames: 'A, B' })] });
    expect(restanteGroups(p)).toEqual(['A', 'B']);
  });
});
