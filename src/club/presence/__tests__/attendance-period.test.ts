import { describe, expect, it } from 'vitest';
import { readPeriod } from '../attendance/period';
import { attendanceSeed, ok, withSaved14 } from './attendance-seed';

describe('attendance by period', () => {
  it('lists the week by day with admin words, the undone list before from (4.1, 4.1a)', async () => {
    const f = attendanceSeed();
    const page = ok(await readPeriod(f.store, { from: '2026-11-16', to: '2026-11-22' }, { date: '2026-11-20', time: '17:30' }));
    // the seed also holds Bronze on Saturday and Sunday (coming), so those days are listed after the Friday
    expect(page.days.map((d) => d.date)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    expect(page.days[0].rows.map((r) => [r.startTime, r.adminState])).toEqual([['17:00', 'necompletat']]);
    expect(page.days[1].rows.map((r) => [r.startTime, r.adminState])).toEqual([['11:00', 'urmeaza']]);
    expect(page.undone.every((r) => r.date < '2026-11-16' && r.sessionId === null)).toBe(true);
    expect(page.undone.length).toBeGreaterThan(0);
    expect(page.undone.map((r) => r.date)).toEqual([...page.undone.map((r) => r.date)].sort().reverse());
    expect([page.from, page.to, page.today, page.startDate]).toEqual(['2026-11-16', '2026-11-22', '2026-11-20', '2026-11-01']);
  });

  it('a time not reached is urmeaza; saved is completat and carries the saved coaches', async () => {
    const f = withSaved14(attendanceSeed());
    const early = ok(await readPeriod(f.store, { from: '2026-11-16', to: '2026-11-22' }, { date: '2026-11-20', time: '16:59' }));
    expect(early.days[0].rows[0]).toMatchObject({ adminState: 'urmeaza', coachIds: ['tm-andreea', 'tm-virgil'] });
    const week = ok(await readPeriod(f.store, { from: '2026-11-09', to: '2026-11-15' }, { date: '2026-11-20', time: '12:00' }));
    const saved = week.days.flatMap((d) => d.rows).find((r) => r.sessionId === 's14');
    expect(saved?.adminState).toBe('completat');
    expect(saved?.coachIds.length).toBeGreaterThan(0);
  });

  it('a future week has no undone rows that are only coming', async () => {
    const f = attendanceSeed();
    const page = ok(await readPeriod(f.store, { from: '2026-12-07', to: '2026-12-13' }, { date: '2026-11-20', time: '12:00' }));
    expect(page.undone.every((r) => r.date <= '2026-11-20')).toBe(true);
  });

  it('no start date: no undone list and no necompletat words', async () => {
    const f = attendanceSeed('2026-11-20', { startDate: null });
    const page = ok(await readPeriod(f.store, { from: '2026-11-16', to: '2026-11-22' }, { date: '2026-11-20', time: '18:00' }));
    expect(page.undone).toEqual([]);
    expect(page.days.map((d) => d.date)).toEqual(['2026-11-21', '2026-11-22']);
    expect(page.days.flatMap((d) => d.rows).every((r) => r.adminState === 'urmeaza')).toBe(true);
  });
});
