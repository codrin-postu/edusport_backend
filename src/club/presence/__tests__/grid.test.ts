import { describe, expect, it } from 'vitest';
import type { GroupRecord } from '../../groups/types';
import type { PeriodRow } from '../attendance/api-types';
import { gridCells, readGrid } from '../attendance/grid';
import { attendanceSeed, ok } from './attendance-seed';

const group = (id: string, name: string, order = 1): GroupRecord => ({ id, name, sectionId: 'afi', order, active: true, priceListId: null, coachIds: [], programPublic: true });
const row = (o: Partial<PeriodRow>): PeriodRow => ({
  sessionId: 's', occurrenceKey: null, groupId: 'g1', groupName: 'Intermediari Bronze', date: '2026-11-03', startTime: '17:00', coachNames: [], coachIds: [],
  present: 0, listed: 0, visitors: 0, state: null, outsideSchedule: false, adminState: 'completat', ...o,
});

describe('group grid', () => {
  it('adds two sessions of a group on one day and shades a planned day (S14)', () => {
    const rows = [
      row({ date: '2026-11-03', present: 8, listed: 9, adminState: 'completat' }), row({ date: '2026-11-03', present: 3, listed: 9, adminState: 'completat' }),
      row({ date: '2026-11-05', present: 0, listed: 9, adminState: 'urmeaza' }),
    ];
    const grid = gridCells(rows, [group('g1', 'Intermediari Bronze')], { from: '2026-11-02', to: '2026-11-08' });
    expect(grid.dates).toHaveLength(7);
    expect(grid.rows[0].cells[1]).toEqual({ date: '2026-11-03', state: 'completat', present: 11, listed: 18, sessions: 2 });
    expect(grid.rows[0].cells[3]).toMatchObject({ state: 'urmeaza', sessions: 1 });
    expect(grid.rows[0].cells[0]).toEqual({ date: '2026-11-02', state: null, present: 0, listed: 0, sessions: 0 });
  });

  it('necompletat wins over urmeaza and completat; groups follow the Program order and only those with rows appear', () => {
    const rows = [
      row({ groupId: 'g2', adminState: 'urmeaza' }), row({ groupId: 'g2', adminState: 'necompletat' }), row({ groupId: 'g1', adminState: 'completat' }),
    ];
    const grid = gridCells(rows, [group('g2', 'B', 1), group('g1', 'A', 2), group('g3', 'C', 0)], { from: '2026-11-02', to: '2026-11-08' });
    expect(grid.rows.map((r) => r.groupId)).toEqual(['g2', 'g1']);
    expect(grid.rows[0].cells[1].state).toBe('necompletat');
  });

  it('readGrid builds the grid of the seed week', async () => {
    const f = attendanceSeed();
    const grid = ok(await readGrid(f.store, { from: '2026-11-16', to: '2026-11-22' }, { date: '2026-11-20', time: '17:30' }));
    expect(grid.rows.map((r) => r.groupName)).toEqual(['Intermediari Bronze', 'Profesioniști']);
    expect(grid.rows[1].cells[4]).toMatchObject({ date: '2026-11-20', state: 'necompletat', sessions: 1 });
  });
});
