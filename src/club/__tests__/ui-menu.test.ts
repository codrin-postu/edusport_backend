import { describe, expect, it } from 'vitest';
import { menuKeyTarget } from '../ui-menu';

describe('menuKeyTarget (menu button pattern)', () => {
  it('ArrowDown and ArrowUp move between items and wrap', () => {
    expect(menuKeyTarget('ArrowDown', 0, 3)).toBe(1);
    expect(menuKeyTarget('ArrowDown', 2, 3)).toBe(0);
    expect(menuKeyTarget('ArrowUp', 1, 3)).toBe(0);
    expect(menuKeyTarget('ArrowUp', 0, 3)).toBe(2);
  });

  it('from outside the items: ArrowDown goes to the first, ArrowUp to the last', () => {
    expect(menuKeyTarget('ArrowDown', -1, 3)).toBe(0);
    expect(menuKeyTarget('ArrowUp', -1, 3)).toBe(2);
  });

  it('Home and End go to the first and the last item', () => {
    expect(menuKeyTarget('Home', 2, 3)).toBe(0);
    expect(menuKeyTarget('End', 0, 3)).toBe(2);
  });

  it('other keys and an empty menu do nothing', () => {
    expect(menuKeyTarget('Enter', 0, 3)).toBeNull();
    expect(menuKeyTarget('Escape', 0, 3)).toBeNull();
    expect(menuKeyTarget('ArrowDown', -1, 0)).toBeNull();
  });
});
