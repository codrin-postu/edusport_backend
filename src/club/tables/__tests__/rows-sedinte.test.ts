import { describe, expect, it } from 'vitest';
import { attendanceRow, sessionRow } from '../../presence/__tests__/fake-store';
import { SESSION_MARK, sedinteTable, sessionKey } from '../rows-sedinte';
import type { TableDefinition } from '../types';
import { definition, TODAY, tablesSeed } from './tables-seed';

const NOW = { date: TODAY, time: '12:00' };
const scoped = (groupId: string | null, period: TableDefinition['scope']['period'] = { kind: 'months', months: ['2026-11'] }): TableDefinition =>
  definition({ subject: 'sedinte', columns: ['sportiv', 'total'], scope: { seasonId: 's26', sectionId: null, groupId, period } });

describe('sedinteTable', () => {
  it('has the athlete, one column per session in date and time order, then the total', async () => {
    const f = tablesSeed();
    f.state.sessions.push(sessionRow({ id: 's5', groupId: 'g-ib', date: '2026-11-10', startTime: '17:00' }));
    f.state.attendances.push(attendanceRow({ id: 't6', sessionId: 's5', athleteId: 'a1', uniqueKey: 's5|a1' }));
    const res = await sedinteTable(f.store, scoped('g-ib'), TODAY, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.columns.map((c) => c.key)).toEqual(['sportiv', 's:s1', 's:s5', 's:s2', 'total']);
    expect(res.data.columns.map((c) => c.label)).toEqual(['Sportiv', 'Sâ 7', 'Ma 10', 'Sâ 14', 'Total']);
    const ana = res.data.rows.find((r) => r.athleteId === 'a1');
    expect(ana?.cells).toEqual({ sportiv: 'Ana Ionescu', 's:s1': SESSION_MARK, 's:s5': SESSION_MARK, 's:s2': SESSION_MARK, total: 3 });
  });

  it('marks present sessions with X, leaves the others null and totals the present ones', async () => {
    const f = tablesSeed();
    f.state.sessions.push(sessionRow({ id: 's5', groupId: 'g-ib', date: '2026-11-10', startTime: '17:00' }));
    f.state.attendances.push(attendanceRow({ id: 't6', sessionId: 's5', athleteId: 'a2', uniqueKey: 's5|a2' }));
    const res = await sedinteTable(f.store, scoped('g-ib'), TODAY, NOW);
    if (!res.ok) throw new Error('refused');
    const mihai = res.data.rows.find((r) => r.athleteId === 'a2');
    expect(mihai?.cells).toEqual({ sportiv: 'Mihai Pop', 's:s1': null, 's:s5': SESSION_MARK, 's:s2': null, total: 1 });
  });

  it('lists a visitor after the members', async () => {
    const f = tablesSeed();
    f.state.attendances.push(attendanceRow({ id: 't7', sessionId: 's1', athleteId: 'a4', uniqueKey: 's1|a4', visitor: true }));
    const res = await sedinteTable(f.store, scoped('g-ib'), TODAY, NOW);
    if (!res.ok) throw new Error('refused');
    expect(res.data.rows.at(-1)).toMatchObject({ athleteId: 'a4', cells: { sportiv: 'Dan Radu', 's:s1': SESSION_MARK, total: 1 } });
  });

  it('gives only the athlete and total columns, no error, for a month without sessions', async () => {
    const res = await sedinteTable(tablesSeed().store, scoped('g-ib', { kind: 'months', months: ['2026-09'] }), TODAY, NOW);
    expect(res.ok && res.data.columns.map((c) => c.key)).toEqual(['sportiv', 'total']);
  });

  it('uses the month of today for the current period and names occurrences by their key', async () => {
    const res = await sedinteTable(tablesSeed().store, scoped('g-av', { kind: 'current' }), TODAY, NOW);
    expect(res.ok && res.data.columns.map((c) => c.key)).toEqual(['sportiv', 's:s3', 's:s4', 'total']);
    expect(sessionKey({ date: '2026-11-07', startTime: '11:00', sessionId: null, occurrenceKey: 'k1', state: 'completat' })).toBe('s:k1');
  });

  it('refuses a missing group, the whole season and a month after the current one', async () => {
    const s = tablesSeed().store;
    for (const d of [scoped(null), scoped('g-ib', null), scoped('g-ib', { kind: 'months', months: ['2026-12'] })]) {
      expect(await sedinteTable(s, d, TODAY, NOW)).toMatchObject({ ok: false, status: 400 });
    }
  });
});
