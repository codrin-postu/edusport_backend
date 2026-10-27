import { describe, expect, it } from 'vitest';
import type { MembershipRow } from '../../athletes/store';
import { currentRows, earliestRow, leaveWrite, planJoin, planMove, planRemove } from '../membership-plan';

const TODAY = '2026-11-20';
const F = { athleteId: 'a1', seasonId: 's26', from: TODAY };
const row = (id: string, groupId: string, isMain: boolean, from: string | null = '2026-10-01', to: string | null = null): MembershipRow =>
  ({ id, athleteId: 'a1', groupId, seasonId: 's26', isMain, from, to });

describe('current rows', () => {
  it('keeps the athlete\'s rows of the season that have not ended', () => {
    const rows = [row('m1', 'g-ib', true), row('m2', 'g-pp', false, '2026-10-01', '2026-10-31'), { ...row('m3', 'g-pro', false), seasonId: 's25' }];
    expect(currentRows(rows, 'a1', 's26').map((r) => r.id)).toEqual(['m1']);
  });
});

describe('leaving a group (W4)', () => {
  it('ends a row that already applied on yesterday', () => {
    expect(leaveWrite(row('m1', 'g-ib', true), TODAY)).toEqual({ op: 'end', id: 'm1', to: '2026-11-19' });
  });

  it('deletes a row that starts today or later (it never applied)', () => {
    expect(leaveWrite(row('m1', 'g-ib', true, TODAY), TODAY)).toEqual({ op: 'delete', id: 'm1' });
    expect(leaveWrite(row('m1', 'g-ib', true, '2027-10-01'), TODAY)).toEqual({ op: 'delete', id: 'm1' });
  });
});

describe('joining a group (3.2, W3)', () => {
  it('is main when the athlete has no group this season', () => {
    expect(planJoin([], 'g-ib', F)).toEqual({ writes: [{ op: 'create', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: TODAY }], main: null });
  });

  it('is not main next to another group', () => {
    expect(planJoin([row('m1', 'g-pro', true)], 'g-ib', F).writes).toEqual([{ op: 'create', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: false, from: TODAY }]);
  });

  it('writes nothing when the athlete is already in the group', () => {
    expect(planJoin([row('m1', 'g-ib', true)], 'g-ib', F)).toEqual({ writes: [], main: null });
  });
});

describe('"Mută" (W2)', () => {
  it('from the main row: the new group becomes main', () => {
    const main = row('m1', 'g-ib', true);
    expect(planMove([main], main, 'g-is', F, TODAY)).toEqual({
      writes: [{ op: 'end', id: 'm1', to: '2026-11-19' }, { op: 'create', athleteId: 'a1', groupId: 'g-is', seasonId: 's26', isMain: true, from: TODAY }],
      main: { fromGroupId: 'g-ib', toGroupId: 'g-is' },
    });
  });

  it('from another row: the main group stays where it was', () => {
    const main = row('m1', 'g-pro', true);
    const other = row('m2', 'g-ib', false);
    expect(planMove([main, other], other, 'g-is', F, TODAY)).toEqual({
      writes: [{ op: 'end', id: 'm2', to: '2026-11-19' }, { op: 'create', athleteId: 'a1', groupId: 'g-is', seasonId: 's26', isMain: false, from: TODAY }],
      main: null,
    });
  });

  it('into a group the athlete is already in: that row keeps going and takes the main flag', () => {
    const main = row('m1', 'g-ib', true);
    const there = row('m2', 'g-pro', false);
    expect(planMove([main, there], main, 'g-pro', F, TODAY).writes).toEqual([{ op: 'end', id: 'm1', to: '2026-11-19' }, { op: 'main', id: 'm2', isMain: true }]);
  });
});

describe('"Scoate din grupă" (W4)', () => {
  it('the remaining group with the earliest start becomes main', () => {
    const main = row('m1', 'g-ib', true, '2026-10-01');
    const late = row('m2', 'g-pro', false, '2026-11-01');
    const early = row('m3', 'g-av', false, '2026-10-15');
    expect(planRemove([main, late, early], main, TODAY)).toEqual({
      writes: [{ op: 'end', id: 'm1', to: '2026-11-19' }, { op: 'main', id: 'm3', isMain: true }],
      main: { fromGroupId: 'g-ib', toGroupId: 'g-av' },
    });
  });

  it('a non-main row leaves alone; the last row leaves the athlete with none', () => {
    const main = row('m1', 'g-ib', true);
    expect(planRemove([main, row('m2', 'g-pro', false)], row('m2', 'g-pro', false), TODAY)).toEqual({ writes: [{ op: 'end', id: 'm2', to: '2026-11-19' }], main: null });
    expect(planRemove([main], main, TODAY)).toEqual({ writes: [{ op: 'end', id: 'm1', to: '2026-11-19' }], main: null });
  });

  it('earliest row: null starts last, then the id', () => {
    expect(earliestRow([row('b', 'g1', false, null), row('a', 'g2', false, null)])?.id).toBe('a');
    expect(earliestRow([row('b', 'g1', false, null), row('c', 'g2', false, '2026-10-01')])?.id).toBe('c');
  });
});
