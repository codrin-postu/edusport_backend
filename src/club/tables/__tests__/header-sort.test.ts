import { describe, expect, it } from 'vitest';
import { nextSort } from '../header-sort';

describe('nextSort', () => {
  it('cycles a column: none, ascending, descending, none', () => {
    const a = nextSort(null, 'suma');
    expect(a).toEqual({ column: 'suma', dir: 'asc' });
    const d = nextSort(a, 'suma');
    expect(d).toEqual({ column: 'suma', dir: 'desc' });
    expect(nextSort(d, 'suma')).toBeNull();
  });
  it('another column starts ascending whatever the current sort', () => {
    expect(nextSort({ column: 'suma', dir: 'desc' }, 'data')).toEqual({ column: 'data', dir: 'asc' });
  });
});
