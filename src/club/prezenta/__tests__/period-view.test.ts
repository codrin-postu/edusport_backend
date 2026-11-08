import { describe, expect, it } from 'vitest';
import type { GridCell } from '../../presence/attendance/api-types';
import { PERIOD_COPY } from '../../presence/copy/prezenta-ui';
import { cellStep, cellText, dayHeader, gridHeader, periodLabel, scrollTarget } from '../period-view';
import { coachPageTo, prezentaTo, readPrezentaQuery } from '../routes';

const cell = (over: Partial<GridCell>): GridCell => ({ date: '2026-11-03', state: 'completat', present: 11, listed: 12, sessions: 1, ...over });

describe('period view', () => {
  it('labels the period', () => {
    expect(periodLabel('zi', { from: '2026-11-06', to: '2026-11-06' }, '2026-11-06')).toBe('Vineri, 6 noi 2026');
    expect(periodLabel('saptamana', { from: '2026-11-02', to: '2026-11-08' }, '')).toBe('2-8 noi');
    expect(periodLabel('saptamana', { from: '2026-11-30', to: '2026-12-06' }, '')).toBe('30 noi - 6 dec');
    expect(periodLabel('saptamana', { from: '2025-12-29', to: '2026-01-04' }, '')).toBe('29 dec 2025 - 4 ian 2026');
    expect(periodLabel('luna', { from: '2026-11-01', to: '2026-11-30' }, '')).toBe('Noiembrie 2026');
  });
  it('day headers and grid headers', () => {
    expect(dayHeader('2026-11-02', '2026-11-06')).toBe('Luni 2 noi');
    expect(dayHeader('2026-11-06', '2026-11-06')).toBe('Vineri 6 noi (azi)');
    expect(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].map((d) => gridHeader('saptamana', d)))
      .toEqual(['Lu 2', 'Ma 3', 'Mi 4', 'J 5', 'V 6', 'S 7', 'D 8']);
    expect(gridHeader('luna', '2026-11-01')).toBe('1');
    expect(gridHeader('luna', '2026-11-30')).toBe('30');
  });
  it('cell text and steps', () => {
    expect(cellText('saptamana', cell({ present: 11, listed: 12 }))).toBe('92%');
    expect(cellText('luna', cell({ present: 11, listed: 12 }))).toBe('92');
    expect(cellText('saptamana', cell({ state: 'urmeaza', present: 0 }))).toBe('');
    expect(cellText('saptamana', cell({ state: null, sessions: 0, present: 0, listed: 0 }))).toBe('');
    expect(cellStep(cell({ state: null, sessions: 0, present: 0, listed: 0 }))).toBe('none');
    expect(cellStep(cell({ state: 'urmeaza', present: 0 }))).toBe('planned');
    expect([0, 5, 8, 10, 12].map((p) => cellStep(cell({ present: p, listed: 12 })))).toEqual(['s0', 's1', 's2', 's3', 's4']);
    expect(cellStep(cell({ present: 19, listed: 20 }))).toBe('s4');
    expect(cellStep(cell({ present: 59, listed: 100 }))).toBe('s1');
    expect(cellStep(cell({ present: 60, listed: 100 }))).toBe('s2');
  });
  it('scroll target', () => {
    const p = { from: '2026-11-01', to: '2026-11-30' };
    expect(scrollTarget([{ date: '2026-11-03' }], '2026-11-06', p)).toBe('2026-11-06');
    expect(scrollTarget([{ date: '2026-11-03' }], '2026-12-06', p)).toBe('2026-11-03');
    expect(scrollTarget([], '2026-12-06', p)).toBe('2026-11-01');
  });
  it('copy of the picker', () => {
    expect(Object.values(PERIOD_COPY.show)).toEqual(['Grupe', 'Lecții individuale', 'Antrenori']);
    expect(PERIOD_COPY.undoneTitle(3)).toBe('Necompletate din zilele trecute (3)');
  });
});

describe('prezenta address', () => {
  const d = '2026-11-06';
  it('reads defaults, new keys and old tab links', () => {
    expect(readPrezentaQuery('', d)).toEqual({ view: 'saptamana', date: d, show: 'grupe', layout: 'lista' });
    expect(readPrezentaQuery('?view=luna&date=2026-10-05&show=antrenori', d)).toEqual({ view: 'luna', date: '2026-10-05', show: 'antrenori', layout: 'lista' });
    expect(readPrezentaQuery('?tab=lectii&month=2026-10', '2026-11-06')).toEqual({ view: 'luna', date: '2026-10-01', show: 'lectii', layout: 'lista' });
    expect(readPrezentaQuery('?tab=sedinte&date=2026-10-26', d)).toEqual({ view: 'luna', date: '2026-10-26', show: 'grupe', layout: 'lista' });
    expect(readPrezentaQuery('?view=x&show=y&date=2026-13-01', d)).toEqual({ view: 'saptamana', date: d, show: 'grupe', layout: 'lista' });
  });
  it('the grid only for Grupe and not in Zi', () => {
    expect(readPrezentaQuery('?layout=grila', d).layout).toBe('grila');
    expect(readPrezentaQuery('?view=zi&layout=grila', d).layout).toBe('lista');
    expect(readPrezentaQuery('?show=lectii&layout=grila', d).layout).toBe('lista');
  });
  it('builds addresses in key order', () => {
    expect(prezentaTo({ layout: 'grila', show: 'grupe', date: '2026-11-02', view: 'luna' })).toBe('/plugins/edusport-prezenta?view=luna&date=2026-11-02&show=grupe&layout=grila');
    expect(coachPageTo('tm1', 'saptamana', '2026-11-02')).toBe('/plugins/edusport-prezenta/antrenor/tm1?view=saptamana&date=2026-11-02');
  });
});
