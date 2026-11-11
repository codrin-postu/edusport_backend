import { describe, expect, it } from 'vitest';
import type { GridCell } from '../../presence/attendance/api-types';
import { coachPageTo, prezentaTo, readPrezentaQuery } from '../routes';

const cell = (over: Partial<GridCell>): GridCell => ({ date: '2026-11-03', state: 'completat', present: 11, listed: 12, sessions: 1, ...over });

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
